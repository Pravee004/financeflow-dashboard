from django.urls import path
from .views import LoginView, UserListView, UserDetailView

urlpatterns = [
    path('auth/login', LoginView.as_view()),
    path('users', UserListView.as_view()),
    path('users/<int:pk>', UserDetailView.as_view()),
]