import React from "react";
import { AUTH_EVENTS, STORAGE_KEYS } from "../constants";
import { useAppDispatch } from "./store";
import { initializeAuthSession, syncAuthState } from "./slices/authSlice";

const AuthSessionBootstrap: React.FC = () => {
  const dispatch = useAppDispatch();

  React.useEffect(() => {
    void dispatch(initializeAuthSession());

    const handleAuthTokenChanged = () => {
      void dispatch(syncAuthState());
    };

    const handleStorage = (event: StorageEvent) => {
      if (
        event.key &&
        event.key !== STORAGE_KEYS.USER_TOKEN &&
        event.key !== STORAGE_KEYS.REFRESH_TOKEN
      ) {
        return;
      }

      handleAuthTokenChanged();
    };

    window.addEventListener(AUTH_EVENTS.TOKEN_CHANGED, handleAuthTokenChanged);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener(
        AUTH_EVENTS.TOKEN_CHANGED,
        handleAuthTokenChanged,
      );
      window.removeEventListener("storage", handleStorage);
    };
  }, [dispatch]);

  return null;
};

export default AuthSessionBootstrap;
