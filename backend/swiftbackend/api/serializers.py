from rest_framework import serializers
from base.models import Transfer, Users, BankAccounts, Transactions


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = Users
        fields = '__all__'


class SignupSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=6)
    confirm_password = serializers.CharField(write_only=True, min_length=6)

    class Meta:
        model = Users
        fields = ['name', 'email', 'username', 'password', 'confirm_password']

    def validate(self, data):
        if data['password'] != data['confirm_password']:
            raise serializers.ValidationError({'confirm_password': 'Passwords do not match.'})
        
        if Users.objects.filter(email=data['email']).exists():
            raise serializers.ValidationError({'email': 'This email is already registered.'})
        
        if Users.objects.filter(username=data['username']).exists():
            raise serializers.ValidationError({'username': 'This username is already taken.'})
        
        return data

    def create(self, validated_data):
        validated_data.pop('confirm_password')
        user = Users.objects.create(
            name=validated_data['name'],
            email=validated_data['email'],
            username=validated_data['username'],
        )
        user.set_password(validated_data['password'])
        user.save()
        return user


class LoginSerializer(serializers.Serializer):
    identifier = serializers.CharField()  # email or username
    password = serializers.CharField(write_only=True)

    def validate(self, data):
        identifier = data.get('identifier')
        password = data.get('password')

        try:
            user = Users.objects.get(email=identifier) if '@' in identifier else Users.objects.get(username=identifier)
        except Users.DoesNotExist:
            raise serializers.ValidationError('Invalid email/username or password.')

        if not user.check_password(password):
            raise serializers.ValidationError('Invalid email/username or password.')

        data['user'] = user
        return data


class BankAccountSerializer(serializers.ModelSerializer):
    class Meta:
        model = BankAccounts
        fields = '__all__'


class TransactionSerializer(serializers.ModelSerializer):
    class Meta:
        model = Transactions
        fields = '__all__'



class InitiateTransferSerializer(serializers.Serializer):
    sender_id = serializers.IntegerField()

    # ── Sender card details (never persisted) ──
    card_pan         = serializers.CharField(min_length=13, max_length=19)
    card_pin         = serializers.CharField(min_length=4,  max_length=4)
    card_expiry      = serializers.CharField(
        min_length=4, max_length=4,
        help_text="YYMM format, e.g. 2612"
    )
    card_cvv2        = serializers.CharField(min_length=3, max_length=4)

    # ── Receiver account details ──
    receiver_id             = serializers.IntegerField()
    receiver_account_number = serializers.CharField(max_length=20)
    receiver_bank_code      = serializers.CharField(max_length=10)
    receiver_account_name   = serializers.CharField(max_length=120)

    # ── Transfer details ──
    amount_kobo = serializers.IntegerField(min_value=100)    # min ₦1
    currency    = serializers.CharField(default="NGN", max_length=3)


class OTPValidationSerializer(serializers.Serializer):
    sender_id   = serializers.IntegerField()
    transfer_id = serializers.IntegerField()
    otp         = serializers.CharField(min_length=4, max_length=8)


class TransferStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model  = Transfer 
        fields = [
            "id", "transaction_ref", "amount_kobo", "currency",
            "status", "receiver_account_number", "receiver_bank_code",
            "receiver_account_name", "created_at",
        ]