from django.urls import path
from . import views


urlpatterns = [
    path('', views.home),
    path('signup/', views.signup, name='signup'),
    path('login/', views.login, name='login'),
    path('users/', views.getusers),
    path('enterbankdetails/', views.enterbankdetails),
    path('getbankdetails/<int:user_id>/', views.getbankdetails),
    path('gettransactions/<int:user_id>/', views.gettransactions),
    path("transfers/initiate/",    views.InitiateTransferView.as_view(), name="transfer-initiate"),
    path("transfers/validate-otp/", views.ValidateOTPView.as_view(),     name="transfer-validate-otp"),
    path("transfers/<int:transfer_id>/", views.TransferStatusView.as_view(), name="transfer-status"),
]