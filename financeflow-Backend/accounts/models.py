from django.contrib.auth.models import AbstractUser
from django.db import models

class User(AbstractUser):
    ROLE_CHOICES = [('admin', 'Admin'), ('analyst', 'Analyst'), ('viewer', 'Viewer')]
    role = models.CharField(max_length=10, choices=ROLE_CHOICES, default='viewer')
    status = models.CharField(max_length=10, default='active')

    # created_at is already provided by AbstractUser as date_joined