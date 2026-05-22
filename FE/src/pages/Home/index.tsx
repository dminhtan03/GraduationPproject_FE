import React from "react";
import { useNavigate } from "react-router-dom";
import { ROUTES } from "../../constants";
import { useHomeOverview } from "../../hooks/useHomeOverview";
import { formatNumber } from "../../utils/helpers";
import type { Room } from "../../types";
import type { RoomListItem, RoomListStatus } from "../../types/roomList";

const FALLBACK_ROOM_IMAGE =
  "https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&q=80&w=800";

const getRoomStatusBadge = (status: RoomListStatus) => {
  const normalized = status.toUpperCase();

  if (normalized === "AVAILABLE") {
    return { label: "AVAILABLE", className: "bg-emerald-500" };
  }
  if (normalized === "BROKEN") {
    return { label: "MAINTENANCE", className: "bg-slate-500" };
  }
  if (normalized === "LEARNING") {
    return { label: "CLASSROOM", className: "bg-purple-500" };
  }
  if (normalized === "UNAVAILABLE") {
    return { label: "OCCUPIED", className: "bg-rose-500" };
  }

  return { label: normalized || "OCCUPIED", className: "bg-rose-500" };
};

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { featuredRooms, loading: loadingRooms, stats } = useHomeOverview();

  const buildRoomState = (room: RoomListItem): { room: Room } => ({
    room: {
      id: room.id,
      roomName: room.roomName,
      building: room.building,
      floorInfo: room.floorInfo,
      slot: room.capacity ?? 0,
      status: room.status,
    },
  });

  const statCards = [
    {
      value: loadingRooms ? "--" : formatNumber(stats.availableRooms),
      label: "Rooms Available",
      accent: true,
    },
    {
      value: loadingRooms ? "--" : formatNumber(stats.occupiedRooms),
      label: "Rooms In Use",
      accent: true,
    },
    {
      value: loadingRooms ? "--" : `${stats.occupancyRate}%`,
      label: "Occupancy Rate",
      accent: false,
    },
    {
      value: loadingRooms ? "--" : formatNumber(stats.totalRooms),
      label: "Total Rooms",
      accent: false,
    },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col overflow-x-hidden">
      {/* ═══════════════════ HERO SECTION ═══════════════════ */}
      <section
        className="relative flex-col items-center justify-center overflow-visible"
        style={{
          background:
            "linear-gradient(135deg, #1e293b 0%, #334155 50%, #475569 100%)",
          paddingBottom: "3rem",
        }}
      >
        {/* decorative circles */}
        <div
          className="pointer-events-none absolute top-0 right-0 h-[420px] w-[420px] sm:h-[520px] sm:w-[520px] lg:h-[600px] lg:w-[600px] rounded-full opacity-10 translate-x-1/3 -translate-y-1/3 animate-blob"
          style={{
            background: "radial-gradient(circle, #f97316 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute bottom-0 left-0 h-[360px] w-[360px] sm:h-[440px] sm:w-[440px] lg:h-[500px] lg:w-[500px] rounded-full opacity-10 -translate-x-1/3 translate-y-1/3 animate-blob animation-delay-2000"
          style={{
            background: "radial-gradient(circle, #fb923c 0%, transparent 70%)",
          }}
        />

        <div className="relative w-full max-w-6xl mx-auto px-4 sm:px-6 py-16 sm:py-20 lg:py-24 z-10 flex flex-col items-center">
          {/* headline */}
          <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-12 mt-6 sm:mt-8">
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-extrabold text-white leading-tight mb-6 tracking-tight drop-shadow-md home-reveal home-delay-1">
              Find your perfect{" "}
              <span
                className="italic font-extrabold block sm:inline mt-2 sm:mt-0"
                style={{ color: "#f97316" }}
              >
                study space
              </span>
            </h1>
            <p className="text-slate-300 text-base sm:text-lg md:text-xl max-w-2xl mx-auto leading-relaxed home-reveal home-delay-2">
              Reserve campus meeting rooms, quiet zones, and collaborative
              spaces in seconds with our AI-powered booking system.
            </p>
          </div>

          {/* ─── inline quick-search bar ─── */}
          <div className="w-full max-w-4xl mx-auto bg-white rounded-3xl sm:rounded-full shadow-2xl p-2 sm:p-3 flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-0 home-reveal home-delay-3">
            {/* building input mock */}
            <div className="flex-1 w-full sm:w-auto flex items-center gap-3 px-5 py-3 sm:py-2">
              <svg
                className="w-5 h-5 text-slate-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              <div className="flex flex-col w-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Location
                </span>
                <input
                  type="text"
                  placeholder="Which building?"
                  className="w-full bg-transparent border-none p-0 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none"
                  readOnly
                  onClick={() => navigate(ROUTES.ROOM_LIST)}
                />
              </div>
            </div>

            <div className="hidden sm:block w-px h-10 bg-slate-200 mx-2" />

            {/* date input mock */}
            <div className="flex-1 w-full sm:w-auto flex items-center gap-3 px-5 py-3 sm:py-2">
              <svg
                className="w-5 h-5 text-slate-400 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
              <div className="flex flex-col w-full">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  Date
                </span>
                <input
                  type="text"
                  placeholder="dd/mm/yyyy"
                  className="w-full bg-transparent border-none p-0 text-sm font-semibold text-slate-800 placeholder-slate-400 focus:ring-0 focus:outline-none cursor-pointer"
                  readOnly
                  onClick={() => navigate(ROUTES.ROOM_LIST)}
                />
              </div>
            </div>

            <div className="hidden sm:block w-px h-10 bg-slate-200 mx-2" />

            {/* time input mock */}
            <div
              className="flex-[0.8] w-full sm:w-auto flex items-center justify-between px-5 py-3 sm:py-2 cursor-pointer"
              onClick={() => navigate(ROUTES.ROOM_LIST)}
            >
              <div className="flex items-center gap-3 w-full">
                <svg
                  className="w-5 h-5 text-slate-400 shrink-0"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <div className="flex flex-col w-full">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Time
                  </span>
                  <div className="text-sm font-semibold text-slate-800">
                    Morning
                  </div>
                </div>
              </div>
              <svg
                className="w-4 h-4 text-slate-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 9l-7 7-7-7"
                />
              </svg>
            </div>

            {/* search button */}
            <button
              type="button"
              onClick={() => navigate(ROUTES.ROOM_LIST)}
              className="w-full sm:w-auto mt-2 sm:mt-0 px-8 py-4 sm:py-4 rounded-full bg-orange-500 text-white text-base font-bold hover:bg-orange-600 active:scale-95 transition-all duration-150 shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={3}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              Search
            </button>
          </div>
        </div>

        {/* ─── stat strip ─── */}
        <div className="absolute -bottom-12 left-0 right-0 max-w-5xl mx-auto px-4 sm:px-6 z-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statCards.map((stat, index) => (
              <div
                key={stat.label}
                className="bg-white/95 backdrop-blur-sm rounded-3xl shadow-xl px-6 py-6 flex flex-col items-center justify-center gap-1 transition-transform hover:-translate-y-1 border border-slate-100/50 home-rise-in"
                style={{ animationDelay: `${200 + index * 80}ms` }}
              >
                <span
                  className="text-3xl font-extrabold leading-none tracking-tight"
                  style={{ color: stat.accent ? "#f97316" : "#1e293b" }}
                >
                  {stat.value}
                </span>
                <span className="text-[11px] font-bold tracking-widest uppercase text-slate-500 mt-1 text-center">
                  {stat.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* spacer for stat strip overflow */}
      <div className="h-12 sm:h-16" />

      {/* ═══════════════════ FEATURED SPACES ═══════════════════ */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-10 sm:py-16 w-full">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-8 gap-4 home-fade-up">
          <div>
            <h2 className="text-3xl font-extrabold text-slate-900 mb-2">
              Featured Spaces
            </h2>
            <p className="text-slate-500">
              The most booked rooms on campus this week.
            </p>
          </div>
          <button
            onClick={() => navigate(ROUTES.ROOM_LIST)}
            className="text-orange-500 font-semibold flex items-center gap-1 hover:text-orange-600 transition home-fade-up"
            style={{ animationDelay: "120ms" }}
          >
            View all rooms
            <svg
              className="w-4 h-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </button>
        </div>

        {loadingRooms ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-slate-200 animate-pulse rounded-3xl h-80"
              ></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {featuredRooms.map((room, index) => {
              const badge = getRoomStatusBadge(room.status);
              const roomImage = room.roomImage || FALLBACK_ROOM_IMAGE;
              const roomTitle = room.roomName || "Unnamed Room";
              const roomDesc = `${room.building || "Building"}, ${
                room.floorInfo || "Floor"
              }`;
              const roomCapacity = room.capacity ?? 0;

              return (
                <div
                  key={room.id}
                  className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden flex flex-col hover:shadow-xl transition-shadow group home-rise-in"
                  style={{ animationDelay: `${140 + index * 90}ms` }}
                >
                  <div className="relative h-48 overflow-hidden bg-slate-200">
                    <img
                      src={roomImage}
                      alt={roomTitle}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div
                      className={`absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold tracking-wide text-white shadow-sm uppercase ${badge.className}`}
                    >
                      {badge.label}
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-xl font-bold text-slate-900 leading-tight">
                        {roomTitle}
                      </h3>
                      <div className="flex items-center gap-1 text-slate-500 bg-slate-100 px-2 py-1 rounded-md text-xs font-semibold shrink-0">
                        <svg
                          className="w-3.5 h-3.5"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                        {roomCapacity}
                      </div>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed mb-6 flex-1">
                      {roomDesc}
                    </p>
                    <button
                      onClick={() =>
                        navigate(
                          ROUTES.ROOM_DETAIL.replace(":roomId", room.id),
                          { state: buildRoomState(room) },
                        )
                      }
                      className="w-full py-2.5 rounded-xl border-2 border-orange-200 text-orange-500 font-bold hover:bg-orange-50 hover:border-orange-500 transition-colors"
                    >
                      Book This Room
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ═══════════════════ UNIBOT AI SECTION ═══════════════════ */}
      <section className="bg-slate-100 py-16 sm:py-20 mt-10 w-full relative overflow-hidden flex-1">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 relative z-10 flex flex-col md:flex-row items-center gap-12 lg:gap-20">
          <div className="flex-1 max-w-xl home-fade-up">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-orange-100 text-orange-600 font-bold text-xs uppercase tracking-widest mb-6">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                  clipRule="evenodd"
                />
              </svg>
              POWERED BY AI
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-slate-900 leading-tight mb-6 tracking-tight">
              Meet <span className="text-orange-500">UniBot</span>, your
              personal campus concierge.
            </h2>
            <p className="text-slate-600 text-lg leading-relaxed mb-8">
              Need a room for 5 people with a projector at 2 PM? Just ask.
              UniBot analyzes availability, preferences, and distance to find
              your best match instantly.
            </p>

            <div className="space-y-6 mb-8">
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-orange-500 font-bold text-lg">⚡</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">
                    Instant Matching
                  </h4>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Matches your specific needs in under 2 seconds.
                  </p>
                </div>
              </div>
              <div className="flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center shrink-0 shadow-sm">
                  <span className="text-orange-500 font-bold text-lg">💡</span>
                </div>
                <div>
                  <h4 className="font-bold text-slate-900 mb-1">
                    Smart Recommendations
                  </h4>
                  <p className="text-slate-500 text-sm leading-relaxed">
                    Suggests better rooms based on your history.
                  </p>
                </div>
              </div>
            </div>

            <button
              onClick={() => navigate(ROUTES.AI_ASSISTANT)}
              className="px-8 py-3.5 rounded-xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:scale-95"
            >
              Try AI Booking Now
            </button>
          </div>

          <div
            className="flex-1 w-full max-w-lg relative home-fade-up"
            style={{ animationDelay: "140ms" }}
          >
            <div className="bg-white rounded-[2rem] shadow-2xl p-6 border border-slate-100 relative z-10">
              <div className="space-y-5 mb-6">
                <div
                  className="flex gap-3 max-w-[85%] home-rise-in"
                  style={{ animationDelay: "120ms" }}
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    AI
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-slate-700 leading-relaxed">
                    Hi Pham! I noticed you have a group project today. Would you
                    like me to find a room in Building Epsilon for 4 people
                    around 3:00 PM?
                  </div>
                </div>

                <div
                  className="flex gap-3 max-w-[85%] ml-auto flex-row-reverse home-rise-in"
                  style={{ animationDelay: "200ms" }}
                >
                  <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    PT
                  </div>
                  <div className="bg-orange-500 rounded-2xl rounded-tr-none px-4 py-3 text-sm text-white leading-relaxed font-medium">
                    Yes, please! Ideally something with a whiteboard.
                  </div>
                </div>

                <div
                  className="flex gap-3 max-w-[85%] home-rise-in"
                  style={{ animationDelay: "280ms" }}
                >
                  <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    AI
                  </div>
                  <div className="bg-slate-100 rounded-2xl rounded-tl-none px-4 py-3 text-sm text-slate-700 leading-relaxed">
                    I've found Room V21-016. It's free from 3-5 PM and has two
                    large whiteboards. Should I book it?
                  </div>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-2 pl-4 flex items-center justify-between">
                <span className="text-slate-400 text-sm">
                  Type your message...
                </span>
                <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center text-white cursor-pointer hover:bg-orange-600">
                  <svg
                    className="w-4 h-4"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </div>
              </div>
            </div>

            {/* abstract shapes behind chat box */}
            <div className="absolute -top-10 -right-10 w-36 h-36 sm:w-40 sm:h-40 bg-orange-200 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob"></div>
            <div className="absolute -bottom-10 -left-10 w-36 h-36 sm:w-40 sm:h-40 bg-purple-200 rounded-full mix-blend-multiply filter blur-2xl opacity-70 animate-blob animation-delay-2000"></div>
          </div>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
