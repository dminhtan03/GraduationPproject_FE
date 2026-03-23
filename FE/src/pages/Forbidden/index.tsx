import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "antd";
import { ROUTES } from "../../constants";

const ForbiddenPage: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-amber-50 to-white px-4">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center justify-center">
        <div className="w-full rounded-3xl border border-orange-200 bg-white/90 p-8 text-center shadow-sm backdrop-blur sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-orange-600">
            Error 403
          </p>
          <h1 className="mt-3 text-3xl font-bold text-orange-900 sm:text-4xl">
            Access denied
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm text-orange-800/80 sm:text-base">
            You do not have permission to access this page.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="primary"
              className="border-orange-500 bg-orange-500"
              onClick={() => navigate(ROUTES.LOGIN, { replace: true })}
            >
              Go to Login
            </Button>
            <Button
              className="border-orange-200 text-orange-700"
              onClick={() => navigate(-1)}
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForbiddenPage;
