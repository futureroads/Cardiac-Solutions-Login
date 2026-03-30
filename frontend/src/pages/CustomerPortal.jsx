import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LogOut,
  Save,
  Plus,
  Trash2,
  Heart,
  Calendar,
} from "lucide-react";
import { toast } from "sonner";
import API_BASE from "../apiBase";

const EMPTY_AED = {
  unit_num: "",
  serial_number: "",
  sentinel_id: "",
  lot_number: "",
  exp_date: "",
  install_date: "",
  consumable_make: "",
  model: "",
  case_cabinet: "",
  location: "",
  nine11_district: false,
};

export default function CustomerPortal({ user, onLogout }) {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const headers = useMemo(() => ({
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  }), [token]);

  const [saving, setSaving] = useState(false);
  const [customer, setCustomer] = useState({
    site_name: "",
    unit_count: 1,
    address: "",
    city: "",
    state: "",
    zip_code: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
  });

  const [aedUnits, setAedUnits] = useState([{ ...EMPTY_AED }]);

  const updateCustomer = (field, value) =>
    setCustomer((prev) => ({ ...prev, [field]: value }));

  const updateAed = (index, field, value) =>
    setAedUnits((prev) =>
      prev.map((u, i) => (i === index ? { ...u, [field]: value } : u))
    );

  const addAed = () => setAedUnits((prev) => [...prev, { ...EMPTY_AED }]);

  const removeAed = (index) =>
    setAedUnits((prev) => prev.filter((_, i) => i !== index));

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/customers`, {
        method: "POST",
        headers,
        body: JSON.stringify({ ...customer, aed_units: aedUnits }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      toast.success("Customer saved successfully");
    } catch (e) {
      toast.error(`Save failed: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [customer, aedUnits, headers]);

  return (
    <div
      className="min-h-screen bg-black text-white"
      data-testid="customer-portal"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-[24px] py-[16px] border-b border-white/10">
        <button
          onClick={() => navigate("/hub")}
          className="flex items-center gap-[8px] px-[16px] py-[8px] border border-red-500/50 rounded-md text-red-400 font-orbitron text-[11px] font-bold tracking-wider hover:bg-red-500/10 transition-all"
          data-testid="exit-btn"
        >
          <LogOut className="w-[14px] h-[14px]" />
          EXIT
        </button>

        <div className="flex items-center gap-[10px]">
          <Heart className="w-[28px] h-[28px] text-red-500 fill-red-500" />
          <div className="text-center">
            <div className="font-orbitron text-[18px] font-bold tracking-wider">
              <span className="text-white">CARDIAC</span>{" "}
              <span className="text-red-500">SOLUTIONS</span>
            </div>
            <div className="font-orbitron text-[9px] tracking-[0.3em] text-red-400/70">
              CUSTOMER PORTAL
            </div>
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-[8px] px-[20px] py-[8px] bg-red-600 rounded-md text-white font-orbitron text-[11px] font-bold tracking-wider hover:bg-red-500 transition-all disabled:opacity-50"
          data-testid="save-btn"
        >
          <Save className="w-[14px] h-[14px]" />
          {saving ? "SAVING..." : "SAVE"}
        </button>
      </div>

      {/* Body */}
      <div className="max-w-[1100px] mx-auto px-[24px] py-[24px]">
        {/* Customer Information */}
        <div className="mb-[32px]">
          <div className="flex items-center gap-[8px] mb-[20px]">
            <div className="w-[3px] h-[20px] bg-cyan-500 rounded-full" />
            <h2
              className="font-orbitron text-[14px] font-bold tracking-[0.15em] text-cyan-400"
              data-testid="customer-info-title"
            >
              CUSTOMER INFORMATION
            </h2>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-md p-[24px]">
            {/* Row 1: Site Name + Unit Count */}
            <div className="grid grid-cols-[1fr_250px] gap-[24px] mb-[20px]">
              <InputField
                label="SITE NAME"
                placeholder="Enter site name"
                value={customer.site_name}
                onChange={(v) => updateCustomer("site_name", v)}
                testId="site-name-input"
              />
              <InputField
                label="UNIT COUNT"
                placeholder="1"
                type="number"
                value={customer.unit_count}
                onChange={(v) => updateCustomer("unit_count", v)}
                testId="unit-count-input"
              />
            </div>
            {/* Row 2: Address, City, State */}
            <div className="grid grid-cols-[1fr_250px_200px] gap-[24px] mb-[20px]">
              <InputField
                label="ADDRESS"
                placeholder="Street address"
                value={customer.address}
                onChange={(v) => updateCustomer("address", v)}
                testId="address-input"
              />
              <InputField
                label="CITY"
                placeholder="City"
                value={customer.city}
                onChange={(v) => updateCustomer("city", v)}
                testId="city-input"
              />
              <InputField
                label="STATE"
                placeholder="State"
                value={customer.state}
                onChange={(v) => updateCustomer("state", v)}
                testId="state-input"
              />
            </div>
            {/* Row 3: Zip */}
            <div className="grid grid-cols-[200px_1fr] gap-[24px] mb-[20px]">
              <InputField
                label="ZIP CODE"
                placeholder="Zip"
                value={customer.zip_code}
                onChange={(v) => updateCustomer("zip_code", v)}
                testId="zip-input"
              />
              <div />
            </div>
            {/* Row 4: First, Last, Email, Phone */}
            <div className="grid grid-cols-4 gap-[24px]">
              <InputField
                label="FIRST NAME"
                placeholder="First name"
                value={customer.first_name}
                onChange={(v) => updateCustomer("first_name", v)}
                testId="first-name-input"
              />
              <InputField
                label="LAST NAME"
                placeholder="Last name"
                value={customer.last_name}
                onChange={(v) => updateCustomer("last_name", v)}
                testId="last-name-input"
              />
              <InputField
                label="EMAIL ADDRESS"
                placeholder="email@example.com"
                type="email"
                value={customer.email}
                onChange={(v) => updateCustomer("email", v)}
                testId="email-input"
              />
              <InputField
                label="PHONE NUMBER"
                placeholder="(555) 555-5555"
                type="tel"
                value={customer.phone}
                onChange={(v) => updateCustomer("phone", v)}
                testId="phone-input"
              />
            </div>
          </div>
        </div>

        {/* AED Units */}
        <div>
          <div className="flex items-center justify-between mb-[20px]">
            <div className="flex items-center gap-[8px]">
              <div className="w-[3px] h-[20px] bg-cyan-500 rounded-full" />
              <h2
                className="font-orbitron text-[14px] font-bold tracking-[0.15em] text-cyan-400"
                data-testid="aed-units-title"
              >
                AED UNITS
              </h2>
            </div>
            <button
              onClick={addAed}
              className="flex items-center gap-[6px] px-[14px] py-[6px] border border-cyan-500/50 rounded-md text-cyan-400 font-orbitron text-[10px] font-bold tracking-wider hover:bg-cyan-500/10 transition-all"
              data-testid="add-aed-btn"
            >
              <Plus className="w-[12px] h-[12px]" />
              ADD AED
            </button>
          </div>

          <div className="bg-white/[0.02] border border-white/10 rounded-md overflow-x-auto">
            <table className="w-full min-w-[1050px]">
              <thead>
                <tr className="border-b border-white/15">
                  {[
                    "#",
                    "UNIT #",
                    "AED SERIAL NUMBER",
                    "AED SENTINEL ID",
                    "LOT NUMBER",
                    "EXP DATE",
                    "INSTALL DATE",
                    "CONSUMABLE MAKE",
                    "MODEL",
                    "CASE/CABINET",
                    "LOCATION",
                    "911 DISTRICT",
                    "",
                  ].map((h, i) => (
                    <th
                      key={i}
                      className="px-[8px] py-[10px] text-left font-orbitron text-[7px] font-bold tracking-[0.15em] text-white/50"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {aedUnits.map((aed, idx) => (
                  <motion.tr
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="border-b border-white/5 hover:bg-white/[0.02]"
                  >
                    <td className="px-[8px] py-[8px] font-orbitron text-[10px] font-bold text-white/40 w-[30px]">
                      {idx + 1}
                    </td>
                    <CellInput
                      value={aed.unit_num}
                      onChange={(v) => updateAed(idx, "unit_num", v)}
                      testId={`aed-${idx}-unit-num`}
                    />
                    <CellInput
                      value={aed.serial_number}
                      onChange={(v) => updateAed(idx, "serial_number", v)}
                      testId={`aed-${idx}-serial`}
                    />
                    <CellInput
                      value={aed.sentinel_id}
                      onChange={(v) => updateAed(idx, "sentinel_id", v)}
                      testId={`aed-${idx}-sentinel`}
                    />
                    <CellInput
                      value={aed.lot_number}
                      onChange={(v) => updateAed(idx, "lot_number", v)}
                      testId={`aed-${idx}-lot`}
                    />
                    <CellDate
                      value={aed.exp_date}
                      onChange={(v) => updateAed(idx, "exp_date", v)}
                      testId={`aed-${idx}-exp-date`}
                    />
                    <CellDate
                      value={aed.install_date}
                      onChange={(v) => updateAed(idx, "install_date", v)}
                      testId={`aed-${idx}-install-date`}
                    />
                    <CellInput
                      value={aed.consumable_make}
                      onChange={(v) => updateAed(idx, "consumable_make", v)}
                      testId={`aed-${idx}-consumable`}
                    />
                    <CellInput
                      value={aed.model}
                      onChange={(v) => updateAed(idx, "model", v)}
                      testId={`aed-${idx}-model`}
                    />
                    <CellInput
                      value={aed.case_cabinet}
                      onChange={(v) => updateAed(idx, "case_cabinet", v)}
                      testId={`aed-${idx}-case`}
                    />
                    <CellInput
                      value={aed.location}
                      onChange={(v) => updateAed(idx, "location", v)}
                      testId={`aed-${idx}-location`}
                    />
                    <td className="px-[8px] py-[8px] w-[60px]">
                      <input
                        type="checkbox"
                        checked={aed.nine11_district}
                        onChange={(e) =>
                          updateAed(idx, "nine11_district", e.target.checked)
                        }
                        className="w-[14px] h-[14px] accent-cyan-500 cursor-pointer"
                        data-testid={`aed-${idx}-911`}
                      />
                    </td>
                    <td className="px-[4px] py-[8px] w-[36px]">
                      <button
                        onClick={() => removeAed(idx)}
                        className="p-[4px] text-red-500/50 hover:text-red-400 transition-colors"
                        data-testid={`aed-${idx}-delete`}
                      >
                        <Trash2 className="w-[14px] h-[14px]" />
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Reusable field components ── */

function InputField({ label, placeholder, value, onChange, type = "text", testId }) {
  return (
    <div>
      <label className="font-orbitron text-[7px] font-bold tracking-[0.2em] text-white/40 mb-[6px] block">
        {label}
      </label>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent border-b border-white/20 pb-[6px] text-[12px] text-white placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50 transition-colors font-sans"
        data-testid={testId}
      />
    </div>
  );
}

function CellInput({ value, onChange, testId }) {
  return (
    <td className="px-[4px] py-[8px]">
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="-"
        className="w-full bg-transparent text-[10px] text-white placeholder:text-white/20 focus:outline-none border-b border-transparent focus:border-cyan-500/30 transition-colors"
        data-testid={testId}
      />
    </td>
  );
}

function CellDate({ value, onChange, testId }) {
  return (
    <td className="px-[4px] py-[8px]">
      <input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-[10px] text-white/60 focus:outline-none border-b border-transparent focus:border-cyan-500/30 transition-colors [color-scheme:dark]"
        data-testid={testId}
      />
    </td>
  );
}
