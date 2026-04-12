"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";

type Department = {
  id: number;
  name: string;
};

export default function DepartmentsPage() {
  const router = useRouter();

  const [departments, setDepartments] = useState<Department[]>([]);
  const [newDepartment, setNewDepartment] = useState("");
  const [message, setMessage] = useState("");
  const [role, setRole] = useState("");

  const loadDepartments = async () => {
    setMessage("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/");
      return;
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    const userRole = profile?.role ?? "";
    setRole(userRole);

    const { data, error } = await supabase
      .from("departments")
      .select("id, name")
      .order("name");

    if (error) {
      setMessage(error.message);
      return;
    }

    setDepartments(data || []);
  };

  useEffect(() => {
    loadDepartments();
  }, []);

  const handleAddDepartment = async () => {
    setMessage("");

    if (role !== "admin") {
      setMessage("Only admins can add departments.");
      return;
    }

    if (!newDepartment.trim()) {
      setMessage("Please enter a department name.");
      return;
    }

    const { error } = await supabase.from("departments").insert({
      name: newDepartment.trim(),
    });

    if (error) {
      setMessage(error.message);
      return;
    }

    setNewDepartment("");
    setMessage("Department added.");
    await loadDepartments();
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f3f4f6",
        padding: "24px",
        color: "black",
      }}
    >
      <div
        style={{
          maxWidth: "900px",
          margin: "0 auto",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
        }}
      >
        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "24px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "16px",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <h1 style={{ fontSize: "30px", fontWeight: "bold", margin: 0 }}>
              Departments
            </h1>

            <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
              <span>Role: {role || "unknown"}</span>
              <button
                onClick={() => router.push("/dashboard")}
                style={{
                  backgroundColor: "black",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  padding: "10px 16px",
                  cursor: "pointer",
                }}
              >
                Back to Dashboard
              </button>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              gap: "12px",
              flexWrap: "wrap",
              marginBottom: "12px",
            }}
          >
            <input
              type="text"
              placeholder="New department name"
              value={newDepartment}
              onChange={(e) => setNewDepartment(e.target.value)}
              style={{
                flex: "1 1 260px",
                border: "1px solid #d1d5db",
                borderRadius: "8px",
                padding: "12px",
                color: "black",
              }}
            />

            <button
              onClick={handleAddDepartment}
              style={{
                backgroundColor: "black",
                color: "white",
                border: "none",
                borderRadius: "8px",
                padding: "10px 16px",
                cursor: "pointer",
              }}
            >
              Add Department
            </button>
          </div>

          {message && <p style={{ marginTop: "8px" }}>{message}</p>}
        </div>

        <div
          style={{
            backgroundColor: "white",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "24px",
          }}
        >
          <h2 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "16px" }}>
            Current Departments
          </h2>

          {departments.length === 0 ? (
            <p>No departments yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {departments.map((department) => (
                <div
                  key={department.id}
                  style={{
                    border: "1px solid #d1d5db",
                    borderRadius: "12px",
                    padding: "16px",
                    backgroundColor: "white",
                  }}
                >
                  <p style={{ margin: 0, fontWeight: "bold" }}>{department.name}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}