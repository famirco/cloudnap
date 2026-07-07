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


def test_get_accounts_empty_initially(client):
    response = client.get("/api/instances/accounts", headers=auth_headers())
    assert response.status_code == 200
    assert response.json() == []


def test_crud_accounts_flow(client):
    # 1. Create a new account
    payload = {
        "name": "Dev Account",
        "role_arn": "arn:aws:iam::123456789012:role/DevAssumptionRole",
        "access_key_id": "AKIA1234567890",
        "secret_access_key": "mysecretaccesskeyvalue",
        "external_id": "myexternalid123",
        "is_active": True
    }
    create_res = client.post("/api/instances/accounts", json=payload, headers=auth_headers())
    assert create_res.status_code == 200
    created_data = create_res.json()
    assert created_data["name"] == "Dev Account"
    assert created_data["role_arn"] == "arn:aws:iam::123456789012:role/DevAssumptionRole"
    assert created_data["access_key_id"] == "********"  # Masked!
    assert created_data["external_id"] == "myexternalid123"
    assert created_data["is_active"] is True
    assert "id" in created_data

    acc_id = created_data["id"]

    # 2. Get list of accounts
    list_res = client.get("/api/instances/accounts", headers=auth_headers())
    assert list_res.status_code == 200
    accounts_list = list_res.json()
    assert len(accounts_list) == 1
    assert accounts_list[0]["id"] == acc_id

    # 3. Test Connection
    test_res = client.post(f"/api/instances/accounts/{acc_id}/test", headers=auth_headers())
    assert test_res.status_code == 200
    assert test_res.json()["status"] == "success"

    # 4. Update the account
    update_payload = {
        "name": "Dev Account",
        "role_arn": "arn:aws:iam::123456789012:role/UpdatedRole",
        "access_key_id": "********",  # keep key same
        "secret_access_key": "********",  # keep secret same
        "is_active": False
    }
    update_res = client.post("/api/instances/accounts", json=update_payload, headers=auth_headers())
    assert update_res.status_code == 200
    updated_data = update_res.json()
    assert updated_data["role_arn"] == "arn:aws:iam::123456789012:role/UpdatedRole"
    assert updated_data["is_active"] is False

    # 5. Delete account
    del_res = client.delete(f"/api/instances/accounts/{acc_id}", headers=auth_headers())
    assert del_res.status_code == 200
    assert del_res.json() == {"message": "Account deleted successfully"}

    # 6. Verify empty again
    verify_res = client.get("/api/instances/accounts", headers=auth_headers())
    assert verify_res.json() == []
