import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.config import settings
from backend.app.db import Base
from backend.app.main import app
from backend.app.routes import instances


@pytest.fixture
def client(monkeypatch):
    monkeypatch.setattr(settings, "APP_PASSWORD", "test-password")

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    TestingSessionLocal = sessionmaker(
        autocommit=False,
        autoflush=False,
        bind=engine,
    )

    Base.metadata.create_all(bind=engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[instances.get_db] = override_get_db

    try:
        yield TestClient(app)
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)


def auth_headers():
    return {"Authorization": "Bearer test-password"}


def test_get_settings_returns_empty_list(client):
    response = client.get("/api/instances/settings", headers=auth_headers())

    assert response.status_code == 200
    assert response.json() == []


def test_post_settings_saves_slack_and_telegram_config(client):
    payload = {
        "settings": [
            {"key": "slack_enabled", "value": "true"},
            {"key": "slack_webhook_url", "value": "https://hooks.slack.com/services/test"},
            {"key": "slack_channel", "value": "#alerts"},
            {"key": "telegram_enabled", "value": "true"},
            {"key": "telegram_bot_token", "value": "test-token"},
            {"key": "telegram_chat_id", "value": "123456"},
        ]
    }

    response = client.post(
        "/api/instances/settings",
        json=payload,
        headers=auth_headers(),
    )

    assert response.status_code == 200
    assert response.json() == {"message": "Settings updated successfully"}

    get_response = client.get("/api/instances/settings", headers=auth_headers())

    assert get_response.status_code == 200

    settings_by_key = {
        item["key"]: item["value"]
        for item in get_response.json()
    }

    assert settings_by_key["slack_enabled"] == "true"
    assert settings_by_key["slack_webhook_url"] == "https://hooks.slack.com/services/test"
    assert settings_by_key["slack_channel"] == "#alerts"
    assert settings_by_key["telegram_enabled"] == "true"
    assert settings_by_key["telegram_bot_token"] == "test-token"
    assert settings_by_key["telegram_chat_id"] == "123456"


def test_post_settings_updates_existing_key(client):
    first_response = client.post(
        "/api/instances/settings",
        json={"settings": [{"key": "slack_enabled", "value": "false"}]},
        headers=auth_headers(),
    )
    second_response = client.post(
        "/api/instances/settings",
        json={"settings": [{"key": "slack_enabled", "value": "true"}]},
        headers=auth_headers(),
    )

    assert first_response.status_code == 200
    assert second_response.status_code == 200

    get_response = client.get("/api/instances/settings", headers=auth_headers())
    settings_by_key = {
        item["key"]: item["value"]
        for item in get_response.json()
    }

    assert settings_by_key["slack_enabled"] == "true"


@pytest.mark.parametrize("method", ["get", "post"])
def test_settings_endpoints_reject_missing_authorization(client, method):
    if method == "get":
        response = client.get("/api/instances/settings")
    else:
        response = client.post(
            "/api/instances/settings",
            json={"settings": [{"key": "slack_enabled", "value": "true"}]},
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Authorization header missing"


@pytest.mark.parametrize("method", ["get", "post"])
def test_settings_endpoints_reject_invalid_authorization(client, method):
    bad_headers = {"Authorization": "Bearer wrong-password"}

    if method == "get":
        response = client.get("/api/instances/settings", headers=bad_headers)
    else:
        response = client.post(
            "/api/instances/settings",
            json={"settings": [{"key": "slack_enabled", "value": "true"}]},
            headers=bad_headers,
        )

    assert response.status_code == 401
    assert response.json()["detail"] == "Invalid credentials"
