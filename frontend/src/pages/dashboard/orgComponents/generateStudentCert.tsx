"use client";

import React, { useState } from "react";

export default function GenerateStudentCert() {
  const [formData, setFormData] = useState({
    studentsName: "",
    onlyYear: "",
    easyGivenDate: "",
    date: "",
  });
  const backendUrl = import.meta.env.VITE_BACKEND_URL;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleMockData = () => {
    setFormData({
      studentsName: "John Doe",
      onlyYear: "2025",
      easyGivenDate: "3rd of April 2025",
      date: "03/04/2025 10:00",
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const response = await fetch(`${backendUrl}/api/generate-cert-temp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(`Error: ${errorData.error || "Failed to generate certificate"}`);
        return;
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Certificate-${formData.studentsName}.pptx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Error submitting form:", err);
      alert("Error generating certificate.");
    }
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white shadow rounded">
      {" "}
      <h1 className="text-xl font-bold mb-4">
        Generate Student Certificate
      </h1>{" "}
      <form className="flex flex-col gap-3" onSubmit={handleSubmit}>
        {" "}
        <input
          type="text"
          name="studentsName"
          placeholder="Student Name"
          value={formData.studentsName}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />{" "}
        <input
          type="text"
          name="onlyYear"
          placeholder="Given Year (e.g., 2025)"
          value={formData.onlyYear}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />{" "}
        <input
          type="text"
          name="easyGivenDate"
          placeholder="Easy Given Date (e.g., 3rd of April 2025)"
          value={formData.easyGivenDate}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />{" "}
        <input
          type="text"
          name="date"
          placeholder="Exact Date (dd/mm/yyyy hh:mm)"
          value={formData.date}
          onChange={handleChange}
          className="border p-2 rounded"
          required
        />{" "}
        <div className="flex gap-2">
          {" "}
          <button
            type="button"
            onClick={handleMockData}
            className="bg-gray-500 text-white p-2 rounded flex-1"
          >
            Fill Mock Data{" "}
          </button>{" "}
          <button
            type="submit"
            className="bg-blue-600 text-white p-2 rounded flex-1"
          >
            Generate Certificate{" "}
          </button>{" "}
        </div>{" "}
      </form>{" "}
    </div>
  );
}
