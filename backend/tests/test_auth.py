"""Auth endpoint tests — register, login, protected routes."""


def test_register(client):
    res = client.post(
        "/auth/register",
        json={
            "email": "newuser@example.com",
            "password": "SecurePass123!",
            "full_name": "New User",
        },
    )
    assert res.status_code == 201
    data = res.json()
    assert data["email"] == "newuser@example.com"
    assert data["full_name"] == "New User"
    assert "id" in data


def test_register_duplicate_email(client):
    payload = {
        "email": "dupe@example.com",
        "password": "SecurePass123!",
    }
    res1 = client.post("/auth/register", json=payload)
    assert res1.status_code == 201
    res2 = client.post("/auth/register", json=payload)
    assert res2.status_code == 400


def test_login_valid(client, test_user):
    res = client.post(
        "/auth/login",
        data={"username": "testuser@example.com", "password": "TestPassword123!"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 200
    data = res.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"
    assert data["user"]["email"] == "testuser@example.com"


def test_login_invalid_password(client, test_user):
    res = client.post(
        "/auth/login",
        data={"username": "testuser@example.com", "password": "wrongpassword"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 401
    assert "Invalid" in res.json()["detail"]


def test_login_nonexistent_user(client):
    res = client.post(
        "/auth/login",
        data={"username": "nobody@example.com", "password": "whatever"},
        headers={"Content-Type": "application/x-www-form-urlencoded"},
    )
    assert res.status_code == 401


def test_protected_route_no_token(client):
    res = client.get("/auth/me")
    assert res.status_code == 401


def test_protected_route_with_token(client, auth_headers):
    res = client.get("/auth/me", headers=auth_headers)
    assert res.status_code == 200
    assert res.json()["email"] == "testuser@example.com"
