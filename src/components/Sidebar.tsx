import { Link, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  Home,
  LogOut,
  CreditCard
} from "lucide-react";

const Sidebar = () => {
  const location = useLocation();

  const isActive = (path) => {
    return location.pathname === path;
  };

  const sidebarItems = [
    { name: "Pagamentos", path: "/", icon: <CreditCard size={20} /> },
  ];

  return (
    <div className="w-60 h-screen bg-gray-100 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center space-x-2">
          <Link to="/" className="flex items-center">
            <img src="/logo-barte.svg" alt="Barte Logo" className="h-8" />
          </Link>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto py-2">
        <nav className="space-y-1 px-2">
          {sidebarItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex items-center px-4 py-3 text-sm rounded-md transition-colors",
                isActive(item.path)
                  ? "bg-gray-200 text-gray-900 font-medium"
                  : "text-gray-600 hover:bg-gray-200 hover:text-gray-900"
              )}
            >
              <span className="mr-3">{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          ))}
        </nav>
      </div>
      <div className="p-4 border-t border-gray-200">
        <button className="flex items-center px-4 py-2 text-sm text-gray-600 rounded-md hover:bg-gray-200 hover:text-gray-900 w-full">
          <LogOut size={20} className="mr-3" />
          <span>Sair</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
