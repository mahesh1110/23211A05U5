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