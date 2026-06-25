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
## Real-Time Notification Design

For real-time updates, I would use WebSocket. After login, the client connects to:

```http
GET /ws/notifications
```

The access token should be verified before the connection is accepted. When a new notification is created, the server pushes this message:

```json
{
  "event": "notification.created",
  "data": {
    "id": "notif_1002",
    "title": "New Login Detected",
    "message": "A new login was detected on your account.",
    "type": "security",
    "priority": "high",
    "isRead": false,
    "createdAt": "2026-06-25T10:30:00Z"
  }
}
```

The server can also send count updates:

```json
{
  "event": "notification.unread_count_updated",
  "data": {
    "unreadCount": 6
  }
}
```

If WebSocket is not supported, Server-Sent Events can be used as a fallback through:

```http
GET /api/v1/notifications/stream
```

## Status Codes

| Code | Meaning |
|---|---|
| 200 | Success |
| 400 | Bad request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Notification not found |
| 500 | Server error |

## Note

The backend should identify the user from the access token, so normal notification APIs do not need `userId` in the request. This also prevents users from accessing another user's notifications.

# Stage 2

## Persistent Storage Choice

I would use **PostgreSQL** for storing notifications. Notifications need reliable storage, filtering by user, read/unread status, sorting by time, and safe updates. PostgreSQL fits well because it supports transactions, indexing, JSON fields if needed, and strong consistency.

## Database Schema

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title VARCHAR(150) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  priority VARCHAR(20) DEFAULT 'normal',
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  read_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL
);

CREATE INDEX idx_notifications_user_created
ON notifications (user_id, created_at DESC);

CREATE INDEX idx_notifications_user_unread
ON notifications (user_id, is_read)
WHERE deleted_at IS NULL;
```

## Problems as Data Increases and Solutions

| Problem | Solution |
|---|---|
| Slow notification listing | Add indexes on `user_id`, `created_at`, and `is_read` |
| Too many old records | Archive or delete old notifications after a fixed retention period |
| Expensive unread count | Cache unread count in Redis and update it when read status changes |
| Large table size | Partition table by month using `created_at` |
| High real-time load | Use a message queue like Kafka/RabbitMQ before pushing through WebSocket |

## Queries Based on REST APIs

### 1. Get Notifications

```sql
SELECT id, title, message, type, priority, action_url, is_read, created_at, read_at
FROM notifications
WHERE user_id = $1
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;
```

### 2. Get Unread Notifications

```sql
SELECT id, title, message, type, priority, action_url, created_at
FROM notifications
WHERE user_id = $1
  AND is_read = FALSE
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### 3. Get Unread Count

```sql
SELECT COUNT(*) AS unread_count
FROM notifications
WHERE user_id = $1
  AND is_read = FALSE
  AND deleted_at IS NULL;
```

### 4. Mark One Notification as Read

```sql
UPDATE notifications
SET is_read = TRUE,
    read_at = CURRENT_TIMESTAMP
WHERE id = $1
  AND user_id = $2
  AND deleted_at IS NULL;
```

### 5. Mark All Notifications as Read

```sql
UPDATE notifications
SET is_read = TRUE,
    read_at = CURRENT_TIMESTAMP
WHERE user_id = $1
  AND is_read = FALSE
  AND deleted_at IS NULL;
```

### 6. Dismiss Notification

```sql
UPDATE notifications
SET deleted_at = CURRENT_TIMESTAMP
WHERE id = $1
  AND user_id = $2;
```

### 7. Create Notification

```sql
INSERT INTO notifications (user_id, title, message, type, priority, action_url)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING id, title, message, type, priority, action_url, is_read, created_at;
```

## Real-Time Storage Flow

When a notification is inserted into PostgreSQL, the backend can publish the same notification to a queue. A WebSocket service then pushes it to the correct logged-in user. This keeps storage reliable and real-time delivery fast.

# Stage 3

The query is logically correct if the requirement is to fetch all unread notifications of student `1042`. However, it is not ideal for production scale.

```sql
SELECT *
FROM notifications
WHERE studentID = 1042
  AND isRead = false
ORDER BY createdAt ASC;
```

## Why It Is Slow

With 5,000,000 notifications, the database may scan a large number of rows, filter by `studentID` and `isRead`, then sort the result by `createdAt`. Also, `SELECT *` fetches every column even if the API needs only a few fields.

