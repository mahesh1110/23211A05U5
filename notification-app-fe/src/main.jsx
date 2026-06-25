import React from "react";
import ReactDOM from "react-dom/client";
import {
  AppBar,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Container,
  CssBaseline,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Tab,
  Tabs,
  ThemeProvider,
  Typography,
  createTheme,
} from "@mui/material";
import NotificationsActiveOutlinedIcon from "@mui/icons-material/NotificationsActiveOutlined";
import PriorityHighOutlinedIcon from "@mui/icons-material/PriorityHighOutlined";
import DoneAllOutlinedIcon from "@mui/icons-material/DoneAllOutlined";
import RefreshOutlinedIcon from "@mui/icons-material/RefreshOutlined";

const typeWeight = {
  Placement: 3,
  Result: 2,
  Event: 1,
};

const theme = createTheme({
  palette: {
    mode: "light",
    primary: { main: "#22577a" },
    secondary: { main: "#c2410c" },
    background: { default: "#f6f8fb" },
  },
  shape: { borderRadius: 8 },
  typography: {
    fontFamily: "Inter, Roboto, Arial, sans-serif",
    h4: { fontWeight: 700 },
    h6: { fontWeight: 700 },
  },
});

function normalizeNotification(notification) {
  return {
    id: notification.ID,
    type: notification.Type,
    message: notification.Message,
    timestamp: notification.Timestamp,
    weight: typeWeight[notification.Type] || 0,
    time: new Date(notification.Timestamp).getTime(),
  };
}

function isHigherPriority(a, b) {
  if (a.weight !== b.weight) return a.weight > b.weight;
  if (a.time !== b.time) return a.time > b.time;
  return a.id > b.id;
}

function getTopNotifications(notifications, limit) {
  return [...notifications]
    .sort((a, b) => (isHigherPriority(a, b) ? -1 : 1))
    .slice(0, limit);
}

async function logEvent(level, packageName, message) {
  try {
    await fetch("/evaluation-service/logs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        stack: "frontend",
        level,
        package: packageName,
        message,
      }),
    });
  } catch {
    // Logging must never break the user flow.
  }
}

async function fetchNotifications({ page = 1, limit = 20, type = "All" }) {
  const params = new URLSearchParams({
    page: String(page),
    limit: String(limit),
  });

  if (type !== "All") {
    params.set("notification_type", type);
  }

  const response = await fetch(`/evaluation-service/notifications?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Unable to fetch notifications (${response.status})`);
  }

  const body = await response.json();
  return (body.notifications || []).map(normalizeNotification);
}

function useViewedNotifications() {
  const [viewedIds, setViewedIds] = React.useState(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem("viewedNotificationIds") || "[]"));
    } catch {
      return new Set();
    }
  });

  const saveViewedIds = React.useCallback((next) => {
    setViewedIds(next);
    localStorage.setItem("viewedNotificationIds", JSON.stringify([...next]));
  }, []);

  const markViewed = React.useCallback(
    (id) => {
      const next = new Set(viewedIds);
      next.add(id);
      saveViewedIds(next);
      logEvent("info", "state", `Notification viewed: ${id}`);
    },
    [saveViewedIds, viewedIds]
  );

  const markManyViewed = React.useCallback(
    (notifications) => {
      const next = new Set(viewedIds);
      notifications.forEach((notification) => next.add(notification.id));
      saveViewedIds(next);
      logEvent("info", "state", "Visible notifications marked as viewed");
    },
    [saveViewedIds, viewedIds]
  );

  return { viewedIds, markViewed, markManyViewed };
}

function NotificationCard({ notification, isViewed, onView }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Stack direction="row" spacing={1} alignItems="flex-start" justifyContent="space-between">
          <Box>
            <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
              <Chip size="small" color={notification.type === "Placement" ? "secondary" : "primary"} label={notification.type} />
              <Chip size="small" variant={isViewed ? "outlined" : "filled"} color={isViewed ? "default" : "success"} label={isViewed ? "Viewed" : "New"} />
            </Stack>
            <Typography variant="h6" sx={{ mt: 1 }}>
              {notification.message}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {notification.timestamp}
            </Typography>
          </Box>
          <Button size="small" variant={isViewed ? "outlined" : "contained"} onClick={() => onView(notification.id)}>
            {isViewed ? "Seen" : "Mark viewed"}
          </Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

function EmptyState({ message }) {
  return (
    <Card variant="outlined">
      <CardContent>
        <Typography color="text.secondary">{message}</Typography>
      </CardContent>
    </Card>
  );
}

function AllNotificationsPage({ viewedIds, markViewed, markManyViewed }) {
  const [page, setPage] = React.useState(1);
  const [type, setType] = React.useState("All");
  const [state, setState] = React.useState({ loading: true, error: "", notifications: [] });

  const load = React.useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const notifications = await fetchNotifications({ page, limit: 12, type });
      setState({ loading: false, error: "", notifications });
      logEvent("info", "api", `Loaded notifications page ${page}`);
    } catch (error) {
      setState({ loading: false, error: error.message, notifications: [] });
      logEvent("error", "api", error.message);
    }
  }, [page, type]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack spacing={2}>
      <Stack direction={{ xs: "column", sm: "row" }} spacing={2} justifyContent="space-between">
        <Box>
          <Typography variant="h4">All Notifications</Typography>
          <Typography color="text.secondary">Latest updates with clear new and viewed status.</Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button startIcon={<DoneAllOutlinedIcon />} variant="outlined" onClick={() => markManyViewed(state.notifications)}>
            Mark visible viewed
          </Button>
          <Button startIcon={<RefreshOutlinedIcon />} variant="contained" onClick={load}>
            Refresh
          </Button>
        </Stack>
      </Stack>

      <FormControl size="small" sx={{ maxWidth: 220 }}>
        <InputLabel>Type</InputLabel>
        <Select label="Type" value={type} onChange={(event) => { setPage(1); setType(event.target.value); }}>
          {["All", "Placement", "Result", "Event"].map((option) => (
            <MenuItem key={option} value={option}>{option}</MenuItem>
          ))}
        </Select>
      </FormControl>

      {state.loading && <CircularProgress />}
      {state.error && <EmptyState message={state.error} />}
      {!state.loading && !state.error && state.notifications.length === 0 && <EmptyState message="No notifications found." />}

      <Stack spacing={1.5}>
        {state.notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            isViewed={viewedIds.has(notification.id)}
            onView={markViewed}
          />
        ))}
      </Stack>

      <Stack direction="row" justifyContent="space-between">
        <Button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>Previous</Button>
        <Typography sx={{ alignSelf: "center" }}>Page {page}</Typography>
        <Button onClick={() => setPage((value) => value + 1)}>Next</Button>
      </Stack>
    </Stack>
  );
}

function PriorityPage({ viewedIds, markViewed }) {
  const [limit, setLimit] = React.useState(10);
  const [type, setType] = React.useState("All");
  const [state, setState] = React.useState({ loading: true, error: "", notifications: [] });

  const load = React.useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const notifications = await fetchNotifications({ page: 1, limit: 100, type });
      setState({ loading: false, error: "", notifications: getTopNotifications(notifications, limit) });
      logEvent("info", "page", `Loaded priority inbox top ${limit}`);
    } catch (error) {
      setState({ loading: false, error: error.message, notifications: [] });
      logEvent("error", "api", error.message);
    }
  }, [limit, type]);

  React.useEffect(() => {
    load();
  }, [load]);

  return (
    <Stack spacing={2}>
      <Box>
        <Typography variant="h4">Priority Notifications</Typography>
        <Typography color="text.secondary">Ranked by Placement, Result, Event, then newest first.</Typography>
      </Box>

      <Stack direction={{ xs: "column", sm: "row" }} spacing={2}>
        <FormControl size="small" sx={{ minWidth: 150 }}>
          <InputLabel>Top N</InputLabel>
          <Select label="Top N" value={limit} onChange={(event) => setLimit(Number(event.target.value))}>
            {[10, 15, 20].map((option) => (
              <MenuItem key={option} value={option}>Top {option}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <FormControl size="small" sx={{ minWidth: 180 }}>
          <InputLabel>Type</InputLabel>
          <Select label="Type" value={type} onChange={(event) => setType(event.target.value)}>
            {["All", "Placement", "Result", "Event"].map((option) => (
              <MenuItem key={option} value={option}>{option}</MenuItem>
            ))}
          </Select>
        </FormControl>
        <Button startIcon={<RefreshOutlinedIcon />} variant="contained" onClick={load}>Refresh</Button>
      </Stack>

      {state.loading && <CircularProgress />}
      {state.error && <EmptyState message={state.error} />}

      <Stack spacing={1.5}>
        {state.notifications.map((notification, index) => (
          <Box key={notification.id}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
              <Chip label={`#${index + 1}`} color="secondary" size="small" />
              <Typography variant="body2" color="text.secondary">Priority score {notification.weight}</Typography>
            </Stack>
            <NotificationCard
              notification={notification}
              isViewed={viewedIds.has(notification.id)}
              onView={markViewed}
            />
          </Box>
        ))}
      </Stack>
    </Stack>
  );
}

function App() {
  const [tab, setTab] = React.useState(0);
  const viewed = useViewedNotifications();

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AppBar position="sticky" color="inherit" elevation={1}>
        <Container maxWidth="lg">
          <Stack direction="row" spacing={2} alignItems="center" justifyContent="space-between">
            <Stack direction="row" spacing={1} alignItems="center">
              <NotificationsActiveOutlinedIcon color="primary" />
              <Typography variant="h6">Notification Inbox</Typography>
            </Stack>
            <Tabs value={tab} onChange={(_, value) => setTab(value)} textColor="primary" indicatorColor="primary">
              <Tab icon={<NotificationsActiveOutlinedIcon />} iconPosition="start" label="All" />
              <Tab icon={<PriorityHighOutlinedIcon />} iconPosition="start" label="Priority" />
            </Tabs>
          </Stack>
        </Container>
      </AppBar>
      <Container maxWidth="lg" sx={{ py: 3 }}>
        {tab === 0 ? <AllNotificationsPage {...viewed} /> : <PriorityPage {...viewed} />}
        <Divider sx={{ my: 3 }} />
        <Typography variant="caption" color="text.secondary">
          Viewed status is maintained on the frontend for this assignment using local storage.
        </Typography>
      </Container>
    </ThemeProvider>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
