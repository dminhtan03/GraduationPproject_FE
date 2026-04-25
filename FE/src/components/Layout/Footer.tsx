// ===== FOOTER COMPONENT (UniBooking) =====

import React from "react";
import { Layout, Typography, Divider } from "antd";
import { useAppSelector, selectTheme } from "../../store";
import { BookOpenIcon } from "@heroicons/react/24/outline";

const { Footer: AntFooter } = Layout;
const { Text, Link } = Typography;

const Footer: React.FC = () => {
  const { mode } = useAppSelector(selectTheme);

  return (
    <AntFooter
      className={`text-center ${
        mode === "dark" ? "bg-gray-800" : "bg-gray-50"
      } border-t`}
      style={{
        background: mode === "dark" ? "#1f2937" : "#f9fafb",
        borderTop: "1px solid #e5e7eb",
      }}
    >
      <div className="max-w-6xl mx-auto px-3 sm:px-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8 py-6 sm:py-8 text-center sm:text-left">
          {/* Brand */}
          <div>
            <div className="flex items-center justify-center sm:justify-start gap-2 mb-3 sm:mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#ff9500" }}
              >
                <BookOpenIcon className="w-4 h-4 text-white" aria-hidden />
              </div>
              <Text strong className="text-base">
                UniBooking
              </Text>
            </div>
            <Text className="text-gray-600 text-sm">
              Smart meeting room booking platform for your campus. Quickly
              browse rooms, check real-time availability, and manage your
              reservations in one place.
            </Text>
          </div>

          {/* Links */}
          <div className="sm:col-span-1">
            <Text strong className="text-base mb-4 block">
              LINKS
            </Text>
            <div className="space-y-2">
              <div>
                <Link
                  href="#"
                  className="text-gray-600 hover:text-orange-500 text-sm"
                >
                  Room List
                </Link>
              </div>
              <div>
                <Link
                  href="#"
                  className="text-gray-600 hover:text-orange-500 text-sm"
                >
                  Room Map
                </Link>
              </div>
              <div>
                <Link
                  href="#"
                  className="text-gray-600 hover:text-orange-500 text-sm"
                >
                  My Bookings
                </Link>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Text strong className="text-base mb-4 block">
              CONTACT
            </Text>
            <div className="space-y-2 text-gray-600 text-sm">
              <div>UniBooking Support</div>
              <div>support@unibooking.edu</div>
            </div>
          </div>
        </div>

        <Divider className="my-3 sm:my-4" />

        <div className="py-3 sm:py-4">
          <Text className="text-gray-500 text-sm">
            © {new Date().getFullYear()} UniBooking. Meeting room booking
            platform for your campus.
          </Text>
        </div>
      </div>
    </AntFooter>
  );
};

export default Footer;
