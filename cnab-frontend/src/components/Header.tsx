
import { Bell, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface HeaderProps {
  title: string;
  hasSearch?: boolean;
  notifications?: { id: string; text: string; time: string }[];
}

const Header = ({ title, hasSearch = false, notifications = [] }: HeaderProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("todas");

  const tabs = [
    { id: "todas", label: "Todas" },
    { id: "pagas", label: "Pagas" },
    { id: "agendadas", label: "Agendadas" },
    { id: "atrasadas", label: "Atrasadas" },
    { id: "canceladas", label: "Canceladas" },
    { id: "desistencia", label: "Desistência" },
    { id: "estornadas", label: "Estornadas" },
    { id: "erro", label: "Erro" },
  ];

  return (
    <div className="border-b border-gray-200 pb-5">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
        <div className="flex items-center space-x-2">
          {hasSearch && (
            <div className="relative w-64">
              <Input
                type="text"
                placeholder="Buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
              {searchTerm ? (
                <X
                  size={18}
                  className="absolute left-2.5 top-2.5 text-gray-400 cursor-pointer"
                  onClick={() => setSearchTerm("")}
                />
              ) : (
                <Search size={18} className="absolute left-2.5 top-2.5 text-gray-400" />
              )}
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon" className="relative">
                <Bell size={18} />
                {notifications.length > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                    {notifications.length}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
              <DropdownMenuLabel>Notificações</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {notifications.length > 0 ? (
                notifications.map((notification) => (
                  <DropdownMenuItem key={notification.id} className="flex flex-col items-start py-2">
                    <div className="font-medium">{notification.text}</div>
                    <div className="text-xs text-gray-500">{notification.time}</div>
                  </DropdownMenuItem>
                ))
              ) : (
                <div className="px-2 py-4 text-center text-gray-500">
                  Não há notificações
                </div>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      
      {title === "Cobranças" && (
        <div className="flex border-b border-gray-200 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={cn(
                "px-4 py-2 text-sm font-medium transition-colors",
                activeTab === tab.id
                  ? "text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-600 hover:text-gray-900"
              )}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default Header;
