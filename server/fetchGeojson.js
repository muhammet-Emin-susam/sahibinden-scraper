const fs = require('fs');
const osmtogeojson = require('osmtogeojson');

async function fetchKonyaNeighborhoods() {
    console.log("Fetching Konya neighborhoods from Overpass API...");
    const query = `
        [out:json][timeout:180];
        area["name"="Konya"]["admin_level"="4"]->.searchArea;
        (
          relation["admin_level"="8"](area.searchArea);
        );
        out geom;
    `;
    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'data=' + encodeURIComponent(query)
    });

    if (!response.ok) {
        console.error("Failed to fetch:", await response.text());
        return;
    }

    const data = await response.json();
    console.log(`Found ${data.elements?.length} matching OSM elements.`);

    // Convert to GeoJSON
    const geojson = osmtogeojson(data);
    fs.writeFileSync('../client/public/konya_mahalleler.geojson', JSON.stringify(geojson));
    console.log("Written to konya_mahalleler.geojson", geojson.features?.length, "features");

    // Also convert districts
    const distData = JSON.parse(fs.readFileSync('konya_districts.json', 'utf8'));
    const distGeojson = osmtogeojson(distData);
    fs.writeFileSync('../client/public/konya_ilceler.geojson', JSON.stringify(distGeojson));
    console.log("Written to konya_ilceler.geojson", distGeojson.features?.length, "features");
}

fetchKonyaNeighborhoods().catch(console.error);
