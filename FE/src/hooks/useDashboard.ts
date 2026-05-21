import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_ENDPOINTS } from "../constants/endpoints";
import { ROUTES } from "../constants";
import {
  adminService,
  type AdminOverviewStats,
} from "../services/adminService";
import { logout } from "../services/authService";
import { api } from "../services/api";
import { extractApiMessage } from "../utils/errorHandlers";

type ProfilePayload = { firstName?: string; lastName?: string; email?: string };

type DashboardState = {
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  stats: AdminOverviewStats | null;
  adminName: string;
  adminEmail: string;
};

type DashboardActions = {
  refresh: () => void;
  handleLogout: () => Promise<void>;
};

export type UseDashboardReturn = DashboardState & DashboardActions;

// ── Custom hook ───────────────────────────────────────────────────────────────
export const useDashboard = (): UseDashboardReturn => {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [adminName, setAdminName] = useState("Admin User");
  const [adminEmail, setAdminEmail] = useState("");

  // ── Load admin profile ─────────────────────────────────────────────────────
  const loadAdminProfile = useCallback(async () => {
    try {
      const res = await api.get<ProfilePayload | { data: ProfilePayload }>(
        API_ENDPOINTS.AUTH.PROFILE,
      );
      const raw = res.data;
      const nested = (raw as { data?: ProfilePayload }).data;
      const data = (nested ?? raw ?? {}) as ProfilePayload;
      setAdminName(
        [data.firstName, data.lastName].filter(Boolean).join(" ") ||
          "Admin User",
      );
      setAdminEmail(data.email ?? "");
    } catch {
      setAdminName("Admin User");
    }
  }, []);

  // ── Load overview stats ────────────────────────────────────────────────────
  const loadOverview = useCallback(async (isRefresh = false) => {
    isRefresh ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = await adminService.getOverviewStats();
      setStats(data);
    } catch (e) {
      setError(extractApiMessage(e, "Unable to load analytics data"));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void loadAdminProfile();
    void loadOverview();
  }, [loadAdminProfile, loadOverview]);

  // ── Actions ────────────────────────────────────────────────────────────────
  const refresh = useCallback(() => void loadOverview(true), [loadOverview]);

  const handleLogout = useCallback(async () => {
    await logout();
    navigate(ROUTES.LOGIN);
  }, [navigate]);

  return {
    loading,
    refreshing,
    error,
    stats,
    adminName,
    adminEmail,
    refresh,
    handleLogout,
  };
};
