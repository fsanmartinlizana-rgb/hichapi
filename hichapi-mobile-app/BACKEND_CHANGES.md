# Required Backend Changes

## PATCH /api/push-tokens

Store Expo push token per authenticated user.

### Request

```
PATCH /api/push-tokens
Authorization: Bearer <session_token>
Content-Type: application/json

{
  "token": "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  "userId": "uuid-of-authenticated-user"
}
```

### Response

```json
{ "success": true }
```

### Implementation Notes

1. Validate the user is authenticated (check JWT via Supabase Auth)
2. Upsert into a `push_tokens` table:
   ```sql
   CREATE TABLE push_tokens (
     id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
     user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
     token TEXT NOT NULL,
     updated_at TIMESTAMPTZ DEFAULT NOW(),
     UNIQUE(user_id)
   );
   ```
3. Use `INSERT ... ON CONFLICT (user_id) DO UPDATE SET token = EXCLUDED.token, updated_at = NOW()`
4. Apply RLS: users can only upsert their own token

### Usage

This token is used by the backend to send push notifications via Expo Push API when:
- A new order is created → notify all garzones of the restaurant
- An order transitions to `paying` → notify all garzones
- An order transitions to `confirmed` → notify kitchen staff
