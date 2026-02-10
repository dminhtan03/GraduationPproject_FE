// ===== FOOTER COMPONENT (UniBooking) =====

import React from "react";
import { Layout, Typography, Divider } from "antd";
import { useAppSelector, selectTheme } from "../../store";

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
      <div className="max-w-6xl mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 py-8 text-left">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: "#ff9500" }}
              >
                <span className="text-white text-sm" aria-hidden>
                  📚
                </span>
              </div>
              <Text strong className="text-base">
                UniBooking
              </Text>
            </div>
            <Text className="text-gray-600 text-sm">
              The official campus facility management platform for students,
              faculty, and administrative staff members.
            </Text>
          </div>

          {/* Links */}
          <div>
            <Text strong className="text-base mb-4 block">
              LINKS
            </Text>
            <div className="space-y-2">
              <div>
                <Link
                  href="#"
                  className="text-gray-600 hover:text-orange-500 text-sm"
                >
                  Support Center
                </Link>
              </div>
              <div>
                <Link
                  href="#"
                  className="text-gray-600 hover:text-orange-500 text-sm"
                >
                  Campus Map
                </Link>
              </div>
            </div>
          </div>

          {/* Contact */}
          <div>
            <Text strong className="text-base mb-4 block">
              CONTACT
            </Text>
            <div className="space-y-2 text-gray-600 text-sm">
              <div>IT Desk</div>
              <div>Ext. 4022</div>
            </div>
          </div>
        </div>

        <Divider className="my-4" />

        <div className="py-4">
          <Text className="text-gray-500 text-sm">
            © {new Date().getFullYear()} UniBooking. Campus facility management
            platform.
          </Text>
        </div>
      </div>
    </AntFooter>
  );
};

export default Footer;
