# Stage 1

## Notification System REST API Design

The notification system will show logged-in users their alerts, updates, reminders, and account-related messages. The API should allow the front end to fetch notifications, update read status, dismiss messages, and receive new notifications in real time.

## Core Actions

1. Get all notifications of the logged-in user.
2. Get unread notifications.
3. Get unread notification count.
4. Mark one notification as read.
5. Mark all notifications as read.
6. Delete or dismiss a notification.
7. Receive notifications in real time.

## Common Headers

```http
Authorization: Bearer <access_token>
Content-Type: application/json
Accept: application/json
```

## Common Response Format

```json
{
  "success": true,
  "message": "Request completed successfully",
  "data": {}
}
```

For errors:

```json
{
  "success": false,
  "message": "Something went wrong",
  "error": {
    "code": "ERROR_CODE",
    "details": "Error details"
  }
}
```

## Notification JSON Schema

```json
{
  "id": "notif_1001",
  "title": "Payment Successful",
  "message": "Your payment has been completed successfully.",
  "type": "payment",
  "priority": "normal",
  "isRead": false,
  "actionUrl": "/payments/txn_8901",
  "createdAt": "2026-06-25T09:30:00Z",
  "readAt": null
}
```
## REST Endpoints

| Action | Method | Endpoint |
|---|---|---|
| Get notifications | GET | `/api/v1/notifications?page=1&limit=20&status=all` |
| Get unread notifications | GET | `/api/v1/notifications?status=unread` |
| Get unread count | GET | `/api/v1/notifications/unread-count` |
| Get one notification | GET | `/api/v1/notifications/{notificationId}` |
| Mark one as read | PATCH | `/api/v1/notifications/{notificationId}/read` |
| Mark all as read | PATCH | `/api/v1/notifications/read-all` |
| Delete/dismiss notification | DELETE | `/api/v1/notifications/{notificationId}` |

## Sample API Contracts

### 1. Get Notifications

```http
GET /api/v1/notifications?page=1&limit=20&status=all
```

Response:

```json
{
  "success": true,
  "message": "Notifications fetched successfully",
  "data": {
    "notifications": [
      {
        "id": "notif_1001",
        "title": "Payment Successful",
        "message": "Your payment has been completed successfully.",
        "type": "payment",
        "priority": "normal",
        "isRead": false,
        "actionUrl": "/payments/txn_8901",
        "createdAt": "2026-06-25T09:30:00Z",
        "readAt": null
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 30
    }
  }
}
```
### 2. Mark Notification as Read

```http
PATCH /api/v1/notifications/{notificationId}/read
```

Response:

```json
{
  "success": true,
  "message": "Notification marked as read",
  "data": {
    "id": "notif_1001",
    "isRead": true,
    "readAt": "2026-06-25T10:00:00Z"
  }
}
```

### 3. Mark All as Read

```http
PATCH /api/v1/notifications/read-all
```

Request:

```json
{
  "before": "2026-06-25T10:00:00Z"
}
```

Response:

```json
{
  "success": true,
  "message": "All notifications marked as read",
  "data": {
    "updatedCount": 8
  }
}
```

### 4. Delete Notification

```http
DELETE /api/v1/notifications/{notificationId}
```

Response:

```json
{
  "success": true,
  "message": "Notification dismissed successfully",
  "data": {
    "notificationId": "notif_1001"
  }
}
```

### 5. Get Unread Count

```http
GET /api/v1/notifications/unread-count
```

Response:

```json
{
  "success": true,
  "message": "Unread count fetched successfully",
  "data": {
    "unreadCount": 5
  }
}
```
