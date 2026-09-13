import pytest
from django.urls import reverse
from rest_framework.test import APIClient


@pytest.mark.django_db
def test_health_check_endpoint():
    client = APIClient()
    response = client.get(reverse("health-check"))
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "healthy"
    assert data["components"]["application"] == "ok"
    assert data["components"]["database"] == "connected"


def test_liveness_check_endpoint():
    client = APIClient()
    response = client.get(reverse("health-live"))
    assert response.status_code == 200
    assert response.json()["status"] == "live"


@pytest.mark.django_db
def test_api_v1_health_check_endpoint():
    client = APIClient()
    response = client.get(reverse("api-v1-health-check"))
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
