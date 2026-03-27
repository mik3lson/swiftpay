from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from base.models import Users, BankAccounts, Transactions
from .serializers import UserSerializer, SignupSerializer, LoginSerializer, BankAccountSerializer, TransactionSerializer
from django.db import transaction
from django.db import models


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
        serializer.save()
        try:
            BankAccounts.objects.create(
                account_number=serializer.validated_data['account_number'],
                user_id= serializer.validated_data['user'].user_id,
                bank_name=serializer.validated_data['bank_name'],
                account_name=serializer.validated_data['account_name']
            )
        except Exception as e:
            return Response({'error': str(e)}, status=400)
        return Response(serializer.data, status=201)
    
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