import React from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";

const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen overflow-hidden bg-slate-950 text-slate-100">
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl items-center justify-center px-6 py-12">
        <div className="pointer-events-none absolute -left-24 top-12 h-72 w-72 rounded-full bg-cyan-400/30 blur-3xl" />
        <div className="pointer-events-none absolute -right-20 bottom-8 h-80 w-80 rounded-full bg-fuchsia-400/20 blur-3xl" />

        <div className="relative w-full max-w-3xl rounded-3xl border border-white/20 bg-white/10 p-8 shadow-2xl backdrop-blur-xl sm:p-12">
          <p className="mb-2 text-xs uppercase tracking-[0.35em] text-cyan-200">Error 403</p>
          <h1 className="text-4xl font-black leading-tight text-white sm:text-5xl" style={{ fontFamily: "'Trebuchet MS', 'Segoe UI', sans-serif" }}>
            You reached a restricted route.
          </h1>
          <p className="mt-4 max-w-xl text-base text-slate-200 sm:text-lg">
            The URL does not map to an accessible page in this application context.
            Use one of the valid navigation paths below.
          </p>

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => navigate(ROUTES.ROOM_LIST)}
              className="rounded-full bg-cyan-400 px-6 py-2.5 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300"
            >
              Go to Room List
            </button>
            <button
              type="button"
              onClick={() => navigate(ROUTES.LOGIN)}
              className="rounded-full border border-white/40 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;
