from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from .models import User
from .serializers import UserSerializer, RegisterSerializer

# Custom permission
class IsAdmin(IsAuthenticated):
    def has_permission(self, request, view):
        return super().has_permission(request, view) and request.user.role == 'admin'


class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        user = authenticate(username=request.data.get('username'),
                            password=request.data.get('password'))
        if not user or user.status != 'active':
            return Response({'error': 'Invalid credentials'}, status=401)
        token = RefreshToken.for_user(user)
        return Response({
            'token': str(token.access_token),
            'user': UserSerializer(user).data
        })


class UserListView(APIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        users = User.objects.all().order_by('-date_joined')
        return Response(UserSerializer(users, many=True).data)

    def post(self, request):  # Admin creates new users
        serializer = RegisterSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        return Response(UserSerializer(user).data, status=201)


class UserDetailView(APIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):  # Toggle active/inactive status
        user = User.objects.get(pk=pk)
        user.status = request.data.get('status', user.status)
        user.role = request.data.get('role', user.role)
        user.save()
        return Response(UserSerializer(user).data)