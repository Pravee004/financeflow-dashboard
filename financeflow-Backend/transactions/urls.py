from django.urls import path
from .views import TransactionView, TransactionDetailView, SummaryView

urlpatterns = [
    path('transactions', TransactionView.as_view()),
    path('transactions/<int:pk>', TransactionDetailView.as_view()),
    path('summary', SummaryView.as_view()),
]
