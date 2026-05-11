/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

export type WorkspaceDepartment = {
  id: number;
  name: string;
};

type WorkspaceContextValue = {
  departments: WorkspaceDepartment[];
  selectedDepartmentId: string;
  selectedDepartment: WorkspaceDepartment | null;
  isWorkspaceActive: boolean;
  isLoading: boolean;
  setSelectedDepartmentId: (departmentId: string) => void;
  clearWorkspace: () => void;
  refreshDepartments: () => Promise<void>;
};

const STORAGE_KEY = "inventory-workspace-department-id";

const WorkspaceContext = createContext<WorkspaceContextValue | undefined>(undefined);

function getInitialDepartmentId() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem(STORAGE_KEY) || "";
}

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [departments, setDepartments] = useState<WorkspaceDepartment[]>([]);
  const [selectedDepartmentId, setSelectedDepartmentIdState] = useState(getInitialDepartmentId);
  const [isLoading, setIsLoading] = useState(true);

  const refreshDepartments = useCallback(async () => {
    setIsLoading(true);

    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name", { ascending: true });

    if (!error) {
      const safeDepartments = (data ?? []) as WorkspaceDepartment[];
      setDepartments(safeDepartments);

      setSelectedDepartmentIdState((current) => {
        if (!current) return "";
        const stillExists = safeDepartments.some((department) => String(department.id) === current);
        if (stillExists) return current;

        if (typeof window !== "undefined") {
          localStorage.removeItem(STORAGE_KEY);
        }
        return "";
      });
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void refreshDepartments();
  }, [refreshDepartments]);

  const setSelectedDepartmentId = useCallback((departmentId: string) => {
    const nextValue = departmentId || "";

    setSelectedDepartmentIdState(nextValue);

    if (typeof window !== "undefined") {
      if (nextValue) {
        localStorage.setItem(STORAGE_KEY, nextValue);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }

      window.dispatchEvent(
        new CustomEvent("inventory-workspace-changed", {
          detail: { departmentId: nextValue },
        })
      );
    }
  }, []);

  const clearWorkspace = useCallback(() => {
    setSelectedDepartmentId("");
  }, [setSelectedDepartmentId]);

  const selectedDepartment = useMemo(() => {
    if (!selectedDepartmentId) return null;
    return departments.find((department) => String(department.id) === selectedDepartmentId) ?? null;
  }, [departments, selectedDepartmentId]);

  const value = useMemo(
    () => ({
      departments,
      selectedDepartmentId,
      selectedDepartment,
      isWorkspaceActive: Boolean(selectedDepartmentId),
      isLoading,
      setSelectedDepartmentId,
      clearWorkspace,
      refreshDepartments,
    }),
    [
      clearWorkspace,
      departments,
      isLoading,
      refreshDepartments,
      selectedDepartment,
      selectedDepartmentId,
      setSelectedDepartmentId,
    ]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);

  if (!context) {
    throw new Error("useWorkspace must be used inside WorkspaceProvider");
  }

  return context;
}
