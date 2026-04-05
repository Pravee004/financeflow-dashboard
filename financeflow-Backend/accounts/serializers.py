from rest_framework import serializers
from .models import User

class UserSerializer(serializers.ModelSerializer):
    created_at = serializers.DateTimeField(source='date_joined', read_only=True)
    class Meta:
        model = User
        fields = ['id', 'username', 'role', 'status', 'created_at']

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    class Meta:
        model = User
        fields = ['username', 'password', 'role']
    def create(self, validated_data):
        return User.objects.create_user(**validated_data)