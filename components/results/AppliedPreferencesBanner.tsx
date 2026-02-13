import type { EmissionClass, PowertrainType, RouteAnalysisResult, VehicleClass } from "@/types/vignette";
import { useState } from "react";

function formatChannel(value: "auto" | "ferry" | "tunnel") {
  if (value === "ferry") {
    return "Prefer ferry";
  }
  if (value === "tunnel") {
    return "Prefer Eurotunnel";
  }
  return "Auto detect";
}

function formatVehicle(value: VehicleClass) {
  if (value === "MOTORCYCLE") {
    return "Motorcycle";
  }
  if (value === "VAN_OR_MPV") {
    return "Camper van / RV";
  }
  return "Car";
}

function formatEmission(value: EmissionClass | undefined) {
  if (value === "ZERO_EMISSION") {
    return "Zero emission";
  }
  if (value === "EURO_6") {
    return "Euro 6+";
  }
  if (value === "EURO_5_OR_LOWER") {
    return "Euro 5 or lower";
  }
  return "Unknown";
}

function formatPowertrain(value: PowertrainType | undefined) {
  if (value === "DIESEL") {
    return "Diesel";
  }
  if (value === "ELECTRIC") {
    return "Electric";
  }
  if (value === "HYBRID") {
    return "Hybrid";
  }
  return "Petrol";
}

export function AppliedPreferencesBanner({ result }: { result: RouteAnalysisResult }) {
  const preferences = result.appliedPreferences ?? {
    avoidTolls: false,
    channelCrossingPreference: "auto" as const,
    vehicleClass: "PASSENGER_CAR_M1" as const,
    powertrainType: "PETROL" as const,
    grossWeightKg: undefined,
    axles: undefined,
    emissionClass: "UNKNOWN" as const,
  };
  const isMotorcycle = preferences.vehicleClass === "MOTORCYCLE";
  const [expanded, setExpanded] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(min-width: 640px)").matches;
  });

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-base font-semibold text-zinc-900">Applied preferences</h3>
        <button
          type="button"
          onClick={() => setExpanded((previous) => !previous)}
          className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
        >
          {expanded ? "Hide" : "Show"}
        </button>
      </div>
      {expanded ? <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
          Avoid toll roads: {preferences.avoidTolls ? "On" : "Off"}
        </span>
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
          Channel crossing: {formatChannel(preferences.channelCrossingPreference)}
        </span>
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
          Vehicle: {formatVehicle(preferences.vehicleClass)}
        </span>
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
          Powertrain: {formatPowertrain(preferences.powertrainType)}
        </span>
        {!isMotorcycle ? (
          <>
            <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
              Gross weight: {preferences.grossWeightKg ? `${preferences.grossWeightKg} kg` : "Not set"}
            </span>
            <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
              Axles: {preferences.axles ?? "Not set"}
            </span>
            <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
              Emission: {formatEmission(preferences.emissionClass)}
            </span>
          </>
        ) : null}
      </div> : (
        <p className="mt-2 text-sm text-zinc-600">
          {formatVehicle(preferences.vehicleClass)}, {formatPowertrain(preferences.powertrainType)}, avoid tolls:{" "}
          {preferences.avoidTolls ? "on" : "off"}.
        </p>
      )}
    </section>
  );
}
