from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.db.models import Sum, Q
from .models import Transaction
from .serializers import TransactionSerializer
from accounts.views import IsAdmin

class IsAnalystOrAdmin(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role in ('analyst', 'admin')


class TransactionView(APIView):
    def get_permissions(self):
        if self.request.method == 'GET':
            return [IsAuthenticated()]
        return [IsAnalystOrAdmin()]  # POST requires analyst+

    def get(self, request):
        qs = Transaction.objects.all()
        # Filters (match your frontend query params)
        if t := request.query_params.get('type'):
            qs = qs.filter(type=t)
        if c := request.query_params.get('category'):
            qs = qs.filter(category__icontains=c)
        if s := request.query_params.get('startDate'):
            qs = qs.filter(date__gte=s)
        if e := request.query_params.get('endDate'):
            qs = qs.filter(date__lte=e)
        return Response(TransactionSerializer(qs, many=True).data)

    def post(self, request):
        s = TransactionSerializer(data=request.data)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data, status=201)


class TransactionDetailView(APIView):
    def get_permissions(self):
        return [IsAnalystOrAdmin()]

    def patch(self, request, pk):
        tx = Transaction.objects.get(pk=pk)
        s = TransactionSerializer(tx, data=request.data, partial=True)
        s.is_valid(raise_exception=True)
        s.save()
        return Response(s.data)

    def delete(self, request, pk):
        Transaction.objects.get(pk=pk).delete()
        return Response(status=204)


class SummaryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        income = Transaction.objects.filter(type='income').aggregate(t=Sum('amount'))['t'] or 0
        expenses = Transaction.objects.filter(type='expense').aggregate(t=Sum('amount'))['t'] or 0

        category_wise = []
        for tx_type in ('income', 'expense'):
            rows = (Transaction.objects.filter(type=tx_type)
                    .values('category')
                    .annotate(total=Sum('amount')))
            for row in rows:
                category_wise.append({'category': row['category'], 'total': float(row['total']), 'type': tx_type})

        recent = Transaction.objects.order_by('-created_at')[:5]
        return Response({
            'totalIncome': float(income),
            'totalExpenses': float(expenses),
            'netBalance': float(income - expenses),
            'categoryWise': category_wise,
            'recentActivity': TransactionSerializer(recent, many=True).data,
        })