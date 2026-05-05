import React from "react";
interface CustomPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalItems?: number;
  pageSize?: number;
  showSummary?: boolean;
  className?: string;
}

const CustomPagination: React.FC<CustomPaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  totalItems,
  pageSize,
  showSummary,
  className,
}) => {
  const normalizedTotalPages = Math.max(1, totalPages);
  const safeCurrentPage = Math.min(
    Math.max(currentPage, 1),
    normalizedTotalPages,
  );
  const hasSummaryData =
    typeof totalItems === "number" && typeof pageSize === "number";
  const shouldShowSummary = showSummary ?? hasSummaryData;
  const shouldShowControls = normalizedTotalPages > 1;

  if (!shouldShowControls && !shouldShowSummary) return null;

  // Dynamically calculate max visible pages based on total pages
  const maxVisible = normalizedTotalPages <= 7 ? normalizedTotalPages : 7;
  const startPage =
    normalizedTotalPages <= maxVisible
      ? 1
      : Math.max(1, Math.min(safeCurrentPage - Math.floor(maxVisible / 2), normalizedTotalPages - maxVisible + 1));
  const visiblePages = Array.from(
    { length: Math.min(normalizedTotalPages, maxVisible) },
    (_, index) => startPage + index,
  );
  const showStartEllipsis = visiblePages[0] > 1;
  const showEndEllipsis =
    visiblePages[visiblePages.length - 1] < normalizedTotalPages;

  const summaryTotal = hasSummaryData ? totalItems : 0;
  const summaryStart =
    summaryTotal === 0 || !hasSummaryData
      ? 0
      : (safeCurrentPage - 1) * pageSize + 1;
  const summaryEnd =
    summaryTotal === 0 || !hasSummaryData
      ? 0
      : Math.min(safeCurrentPage * pageSize, summaryTotal);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > normalizedTotalPages) return;
    if (nextPage === currentPage) return;
    onPageChange(nextPage);
  };

  const wrapperClassName = [
    "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={wrapperClassName}>
      {shouldShowSummary && (
        <span className="text-center text-sm text-slate-600 sm:text-left">
          Showing{" "}
          <span className="font-semibold text-slate-800">{summaryStart}</span>-
          <span className="font-semibold text-slate-800">{summaryEnd}</span> of{" "}
          <span className="font-semibold text-slate-800">{summaryTotal}</span>
        </span>
      )}

      {shouldShowControls ? (
        <div className="flex flex-wrap items-center justify-center gap-1.5 sm:justify-end">
          <button
            type="button"
            disabled={safeCurrentPage <= 1}
            onClick={() => handlePageChange(safeCurrentPage - 1)}
            className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Prev
          </button>

          {showStartEllipsis && (
            <>
              <button
                type="button"
                onClick={() => handlePageChange(1)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
              >
                1
              </button>
              {visiblePages[0] > 2 && (
                <span className="px-1 text-sm text-slate-400">...</span>
              )}
            </>
          )}

          {visiblePages.map((pageNumber) => {
            const isActive = pageNumber === safeCurrentPage;
            return (
              <button
                key={pageNumber}
                type="button"
                onClick={() => handlePageChange(pageNumber)}
                className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border text-sm font-semibold transition ${
                  isActive
                    ? "border-orange-500 bg-orange-500 text-white shadow-sm"
                    : "border-slate-200 bg-white text-slate-700 hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
                }`}
              >
                {pageNumber}
              </button>
            );
          })}

          {showEndEllipsis && (
            <>
              {visiblePages[visiblePages.length - 1] <
                normalizedTotalPages - 1 && (
                <span className="px-1 text-sm text-slate-400">...</span>
              )}
              <button
                type="button"
                onClick={() => handlePageChange(normalizedTotalPages)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700"
              >
                {normalizedTotalPages}
              </button>
            </>
          )}

          <button
            type="button"
            disabled={safeCurrentPage >= normalizedTotalPages}
            onClick={() => handlePageChange(safeCurrentPage + 1)}
            className="inline-flex h-9 items-center rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 transition hover:border-orange-200 hover:bg-orange-50 hover:text-orange-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}
    </div>
  );
};

export default CustomPagination;
