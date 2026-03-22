import React from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";

const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-amber-50 to-emerald-50 px-6 py-10 text-slate-800">
      <div className="mx-auto flex min-h-[calc(100vh-5rem)] w-full max-w-5xl items-center justify-center">
        <div className="relative w-full overflow-hidden rounded-3xl border border-amber-200/70 bg-white shadow-[0_25px_80px_-35px_rgba(15,23,42,0.45)]">
          <div className="absolute -right-10 -top-14 h-44 w-44 rounded-full bg-amber-200/60 blur-2xl" />
          <div className="absolute -left-10 bottom-2 h-48 w-48 rounded-full bg-emerald-200/50 blur-2xl" />

          <div className="relative grid gap-8 p-8 sm:p-12 md:grid-cols-[1.2fr_0.8fr] md:items-center">
            <div>
              <p className="mb-2 text-xs uppercase tracking-[0.35em] text-amber-700">Error 404</p>
              <h1 className="text-4xl font-black leading-tight sm:text-5xl" style={{ fontFamily: "'Gill Sans', 'Trebuchet MS', sans-serif" }}>
                Resource unavailable
              </h1>
              <p className="mt-4 text-base text-slate-600 sm:text-lg">
                The token or authorization state is not valid for this request,
                or the resource cannot be resolved.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.LOGIN)}
                  className="rounded-full bg-slate-900 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-700"
                >
                  Back to Login
                </button>
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.ROOM_LIST)}
                  className="rounded-full border border-slate-300 px-6 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  Try Room List
                </button>
              </div>
            </div>

            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <p className="text-sm font-semibold text-amber-800">Suggested checks</p>
              <ul className="mt-3 space-y-2 text-sm text-amber-900">
                <li>Sign in again to refresh credentials.</li>
                <li>Verify your account has required permissions.</li>
                <li>Open the page from navigation instead of stale links.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
