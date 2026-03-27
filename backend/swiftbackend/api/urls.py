from django.urls import path
from . import views


urlpatterns = [
    path('', views.home),
    path('users/', views.getusers),
    path('enterbankdetails/', views.enterbankdetails),
    path('getbankdetails/<int:user_id>/', views.getbankdetails),
    path('gettransactions/<int:user_id>/', views.gettransactions),
]