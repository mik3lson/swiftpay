from rest_framework.decorators import api_view
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView
from django.shortcuts import get_object_or_404
from django.db import models

from base.models import Users, BankAccounts, Transactions, Transfer
from .serializers import UserSerializer, SignupSerializer, LoginSerializer, BankAccountSerializer, TransactionSerializer
import uuid
import logging

from .serializers import (
    InitiateTransferSerializer,
    OTPValidationSerializer,
    TransferStatusSerializer,
)
from services.interswitch import initiate_purchase, validate_otp

logger   = logging.getLogger(__name__)



# Sign-up endpoint
@api_view(['POST'])
def signup(request):
    serializer = SignupSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.save()
        return Response({
            'message': 'Account created successfully',
            'user_id': user.user_id,
            'username': user.username,
            'email': user.email,
            'name': user.name,
        }, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


# Login endpoint
@api_view(['POST'])
def login(request):
    serializer = LoginSerializer(data=request.data)
    if serializer.is_valid():
        user = serializer.validated_data['user']
        return Response({
            'message': 'Login successful',
            'user_id': user.user_id,
            'username': user.username,
            'email': user.email,
            'name': user.name,
        }, status=status.HTTP_200_OK)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
def home(request):
    return Response({'message': 'Welcome to the SwiftPay API'}, status=200)



@api_view(['GET'])
def getusers(request):
    users = Users.objects.all()
    serializer = UserSerializer(users, many=True)
    return Response(serializer.data, status=200)



@api_view(['POST'])
def enterbankdetails(request):
    serializer = BankAccountSerializer(data=request.data)
    if serializer.is_valid():
        bank = serializer.save()
        return Response(BankAccountSerializer(bank).data, status=201)
    
    return Response(serializer.errors, status=400)



@api_view(['GET'])
def getbankdetails(request, user_id):
    try:
        bank_accounts = BankAccounts.objects.filter(user_id=user_id)
        serializer = BankAccountSerializer(bank_accounts, many=True)
        return Response(serializer.data, status=200)
    
    except BankAccounts.DoesNotExist:
        return Response({'error': 'No bank accounts found for this user'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=400)
    


@api_view(['GET'])
def gettransactions(request, user_id):
    try:
        transactions = Transactions.objects.filter(models.Q(sender_account__user_id=user_id) | models.Q(recipient_account__user_id=user_id))
        serializer = TransactionSerializer(transactions, many=True)
        return Response(serializer.data, status=200)
    
    except Transactions.DoesNotExist:
        return Response({'error': 'No transactions found for this user'}, status=404)
    except Exception as e:
        return Response({'error': str(e)}, status=400)
    




def _record_transaction(transfer: Transfer, sender_bank_account, receiver_bank_account):
    """
    Creates a Transactions record once a transfer is confirmed successful.
    Amount is converted from kobo to naira for the Transactions table.
    """
    amount_naira = transfer.amount_kobo / 100
    Transactions.objects.create(
        sender_account=sender_bank_account,
        recipient_account=receiver_bank_account,
        amount=amount_naira,
    )


def _notify_receiver(receiver, transfer: Transfer):
    """
    Send an in-app / push / email notification to the receiver.
    Replace the body with your actual notification logic
    (e.g. firebase-admin, django-notifications, Celery task, etc.)
    """
    amount_naira = transfer.amount_kobo / 100
    logger.info(
        "NOTIFY user_id=%s: You received ₦%.2f (ref=%s)",
        receiver.user_id, amount_naira, transfer.transaction_ref,
    )
    # Example with django-notifications-hq:
    # from notifications.signals import notify
    # notify.send(
    #     sender=transfer.sender,
    #     recipient=receiver,
    #     verb="sent you",
    #     description=f"₦{amount_naira:,.2f} via card transfer",
    #     action_object=transfer,
    # )


class InitiateTransferView(APIView):
    """
    POST /api/payments/transfers/initiate/

    Accepts card details + receiver info, charges the sender's card,
    records the transfer, and notifies the receiver on success.

    ⚠  Card details are used only in-memory for authData generation
       and are NEVER written to the database.
    """
    permission_classes = []

    def post(self, request):
        serializer = InitiateTransferSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data     = serializer.validated_data
        sender   = get_object_or_404(Users, pk=data["sender_id"])
        receiver = get_object_or_404(Users, pk=data["receiver_id"])

        if receiver == sender:
            return Response(
                {"detail": "Sender and receiver cannot be the same account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # ── Resolve BankAccounts for both sides ───────────────
        try:
            sender_bank_account = BankAccounts.objects.get(user=sender)
        except BankAccounts.DoesNotExist:
            return Response(
                {"detail": "Sender does not have a linked bank account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            receiver_bank_account = BankAccounts.objects.get(user=receiver)
        except BankAccounts.DoesNotExist:
            return Response(
                {"detail": "Receiver does not have a linked bank account."},
                status=status.HTTP_400_BAD_REQUEST,
            )

        ref = f"TXN-{uuid.uuid4().hex[:16].upper()}"

        # ── Create a PENDING transfer record ──────────────────
        transfer = Transfer.objects.create(
            sender=sender,
            receiver=receiver,
            receiver_account_number=data["receiver_account_number"],
            receiver_bank_code=data["receiver_bank_code"],
            receiver_account_name=data["receiver_account_name"],
            amount_kobo=data["amount_kobo"],
            currency=data["currency"],
            transaction_ref=ref,
            status=Transfer.Status.PENDING,
        )

        # ── Call Interswitch (card details stay in memory) ────
        try:
            isw_response = initiate_purchase(
                amount_kobo=data["amount_kobo"],
                pan=data["card_pan"],
                pin=data["card_pin"],
                expiry_date=data["card_expiry"],
                cvv2=data["card_cvv2"],
                customer_id=str(sender.user_id),
                transaction_ref=ref,
                currency=data["currency"],
            )
        except Exception as exc:
            transfer.status = Transfer.Status.FAILED
            transfer.isw_response_raw = {"error": str(exc)}
            transfer.save(update_fields=["status", "isw_response_raw"])
            logger.exception("Interswitch purchase failed ref=%s", ref)
            return Response(
                {"detail": "Payment gateway error. Please try again.", "ref": ref},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        # ── Persist Interswitch response ───────────────────────
        payment_id  = isw_response.get("paymentId", "")
        isw_message = isw_response.get("message", "").upper()

        transfer.isw_payment_id   = payment_id
        transfer.isw_response_raw = isw_response

        # Interswitch returns "APPROVED" on straight-through, or
        # "OTP_REQUIRED" / "T3D_REQUIRED" when a challenge is needed
        if isw_message in ("APPROVED", "SUCCESSFUL"):
            transfer.status = Transfer.Status.SUCCESS
            transfer.save(update_fields=["status", "isw_payment_id", "isw_response_raw"])
            _record_transaction(transfer, sender_bank_account, receiver_bank_account)
            _notify_receiver(receiver, transfer)
            return Response(
                {
                    "detail": "Transfer successful.",
                    "transfer_id": transfer.id,
                    "transaction_ref": ref,
                    "isw_payment_id": payment_id,
                },
                status=status.HTTP_200_OK,
            )

        # OTP / 3DS challenge flow
        if "OTP" in isw_message or "T3D" in isw_message or payment_id:
            transfer.status = Transfer.Status.OTP_SENT
            transfer.save(update_fields=["status", "isw_payment_id", "isw_response_raw"])
            return Response(
                {
                    "detail": "OTP required. Submit OTP to /transfers/validate-otp/.",
                    "transfer_id": transfer.id,
                    "transaction_ref": ref,
                    "isw_payment_id": payment_id,
                },
                status=status.HTTP_202_ACCEPTED,
            )

        # Unexpected / declined response
        transfer.status = Transfer.Status.FAILED
        transfer.save(update_fields=["status", "isw_payment_id", "isw_response_raw"])
        return Response(
            {"detail": "Payment declined.", "isw_message": isw_message, "ref": ref},
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )


class ValidateOTPView(APIView):
    """
    POST /api/payments/transfers/validate-otp/

    Submits the OTP for a pending transfer and finalises it.
    """
    permission_classes = []

    def post(self, request):
        serializer = OTPValidationSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

        data     = serializer.validated_data
        sender = get_object_or_404(Users, pk=data["sender_id"])
        transfer = get_object_or_404(
            Transfer,
            pk=data["transfer_id"],
            sender=sender,
            status=Transfer.Status.OTP_SENT,
        )

        try:
            isw_response = validate_otp(
                payment_id=transfer.isw_payment_id,
                otp=data["otp"],
            )
        except Exception as exc:
            logger.exception("OTP validation failed transfer_id=%s", transfer.id)
            return Response(
                {"detail": "OTP validation failed.", "error": str(exc)},
                status=status.HTTP_502_BAD_GATEWAY,
            )

        isw_message = isw_response.get("message", "").upper()
        transfer.isw_response_raw = {**transfer.isw_response_raw, "otp_response": isw_response}

        if isw_message in ("APPROVED", "SUCCESSFUL"):
            transfer.status = Transfer.Status.SUCCESS
            transfer.save(update_fields=["status", "isw_response_raw"])
            sender_bank_account   = BankAccounts.objects.get(user=transfer.sender)
            receiver_bank_account = BankAccounts.objects.get(user=transfer.receiver)
            _record_transaction(transfer, sender_bank_account, receiver_bank_account)
            _notify_receiver(transfer.receiver, transfer)
            return Response(
                {"detail": "Transfer approved.", "transaction_ref": transfer.transaction_ref},
                status=status.HTTP_200_OK,
            )

        transfer.status = Transfer.Status.FAILED
        transfer.save(update_fields=["status", "isw_response_raw"])
        return Response(
            {"detail": "OTP rejected or transfer declined.", "isw_message": isw_message},
            status=status.HTTP_402_PAYMENT_REQUIRED,
        )


class TransferStatusView(APIView):
    """
    GET /api/payments/transfers/<transfer_id>/
    """
    permission_classes = []

    def get(self, request, transfer_id):
        sender_id = request.query_params.get("sender_id")
        if not sender_id:
            return Response({"detail": "sender_id query parameter is required."}, status=status.HTTP_400_BAD_REQUEST)

        transfer = get_object_or_404(
            Transfer,
            pk=transfer_id,
            sender_id=sender_id,
        )
        return Response(TransferStatusSerializer(transfer).data)
