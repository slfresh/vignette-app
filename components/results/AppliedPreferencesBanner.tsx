import type { RouteAnalysisResult, VehicleClass } from "@/types/vignette";

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

export function AppliedPreferencesBanner({ result }: { result: RouteAnalysisResult }) {
  const preferences = result.appliedPreferences ?? {
    avoidTolls: false,
    channelCrossingPreference: "auto" as const,
    vehicleClass: "PASSENGER_CAR_M1" as const,
  };

  return (
    <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
      <h3 className="text-base font-semibold text-zinc-900">Applied preferences</h3>
      <div className="mt-2 flex flex-wrap gap-2 text-sm">
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
          Avoid toll roads: {preferences.avoidTolls ? "On" : "Off"}
        </span>
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
          Channel crossing: {formatChannel(preferences.channelCrossingPreference)}
        </span>
        <span className="rounded-full border border-zinc-300 bg-zinc-50 px-3 py-1 text-zinc-800">
          Vehicle: {formatVehicle(preferences.vehicleClass)}
        </span>
      </div>
    </section>
  );
}
