/**
 * Dedicated prompt for the AI Route Briefing feature.
 *
 * Instructs the LLM to produce a structured, actionable briefing
 * covering weather, traffic, speed cameras, tolls, and border crossings.
 */

export const BRIEFING_USER_PROMPT = `Based on ALL the data provided (route, weather, traffic, speed cameras), generate a comprehensive Route Briefing for this trip. Structure your response with these sections using markdown headers:

## Weather Overview
Summarize weather conditions along the route. Highlight any warnings (strong wind, rain, snow, fog, freezing). Give practical driving advice for the conditions.

## Traffic & Road Conditions
Summarize active incidents (construction, closures, congestion). Mention severity and affected roads. Suggest alternatives or timing changes if relevant.

## Speed Camera Alert
Report the total number of cameras along the route. Mention the roads with the most cameras and any notably low speed limits. Remind the driver of key limits.

## Vignettes & Tolls
List each country on the route and what the driver needs: vignette (with cost), section tolls, or nothing. Include where to buy and common mistakes to avoid.

## Border Crossings
List each border crossing with practical tips. Mention documents needed and any known wait time patterns.

## Key Warnings
Bullet-point the most critical things the driver must pay attention to on this specific route. Be specific — mention road names, locations, and conditions.

RULES:
- Be concise but thorough — aim for 300-500 words total.
- Use bullet points within sections for readability.
- If data for a section is missing or empty, say "No data available" and move on.
- Always end with a one-line safe driving reminder.
- Use metric units (km, km/h, °C).`;
