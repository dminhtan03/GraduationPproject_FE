import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { MagnifyingGlassIcon, ChevronDownIcon, XMarkIcon } from "@heroicons/react/24/outline";

export interface UserItem {
  id: string;
  fullName: string;
  email: string;
}

export interface SelectUserProps {
  value?: string;
  onChange: (userId: string) => void;
  placeholder?: string;
  usersList?: UserItem[];
  onSearchRemote?: (query: string) => void;
  searchResults?: UserItem[];
  isLoading?: boolean;
}

export const SelectUser: React.FC<SelectUserProps> = ({
  value,
  onChange,
  placeholder = "Select a user...",
  usersList = [],
  onSearchRemote,
  searchResults,
  isLoading = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [dropdownPos, setDropdownPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });

  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const updateDropdownPos = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 8, left: rect.left, width: rect.width });
    }
  };

  const handleOpen = () => {
    updateDropdownPos();
    setIsOpen(true);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        triggerRef.current && !triggerRef.current.contains(target)
      ) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // Keep position in sync with scroll/resize while open
  useEffect(() => {
    if (!isOpen) return;
    const update = () => updateDropdownPos();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen]);

  // Remote search
  useEffect(() => {
    if (isOpen && onSearchRemote) {
      onSearchRemote(search);
    }
  }, [search, isOpen, onSearchRemote]);

  const getInitials = (name?: string) => {
    if (!name) return "U";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().substring(0, 2);
  };

  const displayUsers = onSearchRemote
    ? searchResults || []
    : usersList.filter(
        (u) =>
          u.fullName.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase())
      );

  const allAvailableUsers = [...usersList, ...(searchResults || [])];
  const selectedUser = allAvailableUsers.find((u) => u.id === value);

  const handleSelect = (userId: string) => {
    onChange(userId);
    setIsOpen(false);
    setSearch("");
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("");
    setSearch("");
  };

  const dropdown = isOpen
    ? createPortal(
        <div
          ref={dropdownRef}
          style={{
            position: "fixed",
            top: dropdownPos.top,
            left: dropdownPos.left,
            width: dropdownPos.width,
            zIndex: 9999,
          }}
          className="rounded-2xl border border-slate-100 bg-white shadow-xl shadow-slate-900/10 overflow-hidden flex flex-col max-h-[280px]"
        >
          {/* Search box */}
          <div className="relative border-b border-slate-100 p-2 bg-slate-50/30 shrink-0">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              ref={inputRef}
              type="text"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-4 focus:ring-orange-100 focus:border-orange-400 bg-white"
              placeholder="Search by name or email..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <div className="w-5 h-5 rounded-full border-2 border-orange-500 border-t-transparent animate-spin" />
                <span className="text-xs font-semibold text-slate-400 ml-2">Searching...</span>
              </div>
            ) : displayUsers.length === 0 ? (
              <div className="py-6 px-4 text-center">
                <p className="text-xs font-semibold text-slate-400">
                  {search ? "No team members found" : onSearchRemote ? "Type to search" : "No members available"}
                </p>
              </div>
            ) : (
              displayUsers.map((u) => (
                <button
                  key={u.id}
                  type="button"
                  onClick={() => handleSelect(u.id)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-600 flex items-center justify-center font-bold text-xs shrink-0">
                    {getInitials(u.fullName)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-800 leading-tight">{u.fullName}</p>
                    <p className="text-xs text-slate-400 truncate leading-none mt-0.5">{u.email}</p>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <div className="relative w-full" ref={triggerRef}>
      {selectedUser ? (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-slate-50/50 border border-slate-200/80 hover:border-orange-300 transition-all duration-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-500 flex items-center justify-center font-bold text-white shadow-sm shadow-orange-500/10 text-sm">
              {getInitials(selectedUser.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-slate-800 leading-tight">{selectedUser.fullName}</p>
              <p className="text-xs text-slate-400 mt-0.5 leading-none">{selectedUser.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="flex items-center justify-center w-7 h-7 rounded-xl text-slate-400 hover:text-red-500 hover:bg-red-50 transition-all duration-150"
            aria-label="Clear selection"
          >
            <XMarkIcon className="h-4.5 w-4.5" />
          </button>
        </div>
      ) : (
        <div
          onClick={handleOpen}
          className="flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50/40 cursor-pointer transition-all duration-150 h-11"
        >
          <span className="text-sm text-slate-400 font-medium">{placeholder}</span>
          <ChevronDownIcon className="h-4.5 w-4.5 text-slate-400" />
        </div>
      )}

      {dropdown}
    </div>
  );
};

export default SelectUser;
