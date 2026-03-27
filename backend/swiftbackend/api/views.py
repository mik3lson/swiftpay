from rest_framework.decorators import api_view
from base.models import Users, BankAccounts, Transactions
from .serializers import UserSerializer, BankAccountSerializer, TransactionSerializer
from rest_framework.response import Response
from django.db import transaction
from django.db import models


# Sign-up and login views 

'''
@api_view([POST])
def signup(request):
    serializer = UserSerializer(data=request.data)
    if serializer.is_valid():
        serializer.save()
        return Response(serializer.data, status=201)
    return Response(serializer.errors, status=400)


@api_view(['POST'])
def login(request):
    email = request.data.get('email')
    password = request.data.get('password')
    try:
        user = Users.objects.get(email=email, password=password)
        serializer = UserSerializer(user)
        return Response(serializer.data, status=200)
    except Users.DoesNotExist:
        return Response({'error': 'Invalid email or password'}, status=400)
'''
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