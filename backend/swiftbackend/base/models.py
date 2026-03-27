from django.db import models
from django.contrib.auth.hashers import make_password, check_password

# Create your models here.



class Users(models.Model):
    user_id = models.AutoField(primary_key = True)
    name = models.CharField(max_length=100)
    email = models.EmailField(max_length=100, unique=True)
    username = models.CharField(max_length=50, unique=True, null=True, blank=True)
    password = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True, null=True)

    def set_password(self, raw_password):
        """Hash and set the password."""
        self.password = make_password(raw_password)

    def check_password(self, raw_password):
        """Check if the provided password matches the hashed password."""
        return check_password(raw_password, self.password)

    def __str__(self):
        return f'{self.user_id} - {self.name} - {self.email}'
    


class BankAccounts(models.Model):
    account_id = models.AutoField(primary_key = True)
    user = models.ForeignKey(Users, on_delete=models.CASCADE)
    account_name = models.CharField(max_length=100)
    account_number = models.CharField(max_length=20)
    bank_name = models.CharField(max_length=100)

    def __str__(self):
        return f'{self.account_id} - {self.user.name} - {self.account_number} - {self.account_name}'
    


class Transactions(models.Model):
    transaction_id = models.AutoField(primary_key = True)
    sender_account = models.ForeignKey(BankAccounts, related_name='sender_account', on_delete=models.CASCADE)
    recipient_account = models.ForeignKey(BankAccounts, related_name='recipient_account', on_delete=models.CASCADE)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    timestamp = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'{self.transaction_id} - {self.sender_account.account_number} -> {self.recipient_account.account_number} : {self.amount}'