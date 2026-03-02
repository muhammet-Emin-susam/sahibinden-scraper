const fs = require('fs');
const osmtogeojson = require('osmtogeojson');
const booleanPointInPolygon = require('@turf/boolean-point-in-polygon').default;
const centerOfMass = require('@turf/center-of-mass').default;
const voronoi = require('@turf/voronoi').default;
const intersect = require('@turf/intersect').default;
const bbox = require('@turf/bbox').default;
const { featureCollection, point } = require('@turf/helpers');

async function buildRapidMahalleler() {
    console.log("Fetching all Konya neighborhoods as highly-optimized Centers (Points) from Overpass...");
    const query = `
        [out:json][timeout:120];
        area["name"="Konya"]["admin_level"="4"]->.searchArea;
        (
          nwr["admin_level"~"8|9"](area.searchArea);
          nwr["place"="neighbourhood"](area.searchArea);
          nwr["place"="village"](area.searchArea);
        );
        out center;
    `;

    const response = await fetch('https://overpass-api.de/api/interpreter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'data=' + encodeURIComponent(query)
    });

    if (!response.ok) return console.error("Fetch failed");

    const data = await response.json();
    let geo = osmtogeojson(data);

    console.log("Reading districts for Voronoi clipping...");
    const ilcelerGeojson = JSON.parse(fs.readFileSync('../client/public/konya_ilceler.geojson', 'utf8'));
    const distFeatures = ilcelerGeojson.features.filter(f => f.geometry && f.geometry.type !== 'Point');

    const points = [];

    geo.features.forEach(f => {
        if (!f.geometry || (!f.properties.name && !f.properties['name:tr'])) return;
        f.properties.name = f.properties.name || f.properties['name:tr'];

        // out center forces everything to be a Point geometry in osmtogeojson sometimes,
        // but let's be safe:
        if (f.geometry.type === 'Point') {
            points.push(f);
        } else if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
            try {
                const pt = centerOfMass(f);
                pt.properties = f.properties;
                points.push(pt);
            } catch (e) { }
        }
    });

    console.log(`Found ${points.length} neighborhood centers.`);

    // Map each point to a district
    const processedPoints = [];
    points.forEach(pt => {
        for (const ilce of distFeatures) {
            if (booleanPointInPolygon(pt, ilce)) {
                pt.properties.ilce = ilce.properties.name;
                processedPoints.push(pt);
                break;
            }
        }
    });

    console.log(`Matched ${processedPoints.length} points to districts. Calculating Voronoi boundaries...`);

    const generatedPolygons = [];

    let successCount = 0;
    for (const ilce of distFeatures) {
        const ilceName = ilce.properties.name;
        const ptsInIlce = processedPoints.filter(p => p.properties.ilce === ilceName);

        if (ptsInIlce.length === 0) continue;

        if (ptsInIlce.length === 1) {
            const newPoly = JSON.parse(JSON.stringify(ilce));
            newPoly.properties = ptsInIlce[0].properties;
            generatedPolygons.push(newPoly);
            successCount++;
            continue;
        }

        const bboxIlce = bbox(ilce);
        const ptsCollection = featureCollection(ptsInIlce);

        try {
            const voronoiPolys = voronoi(ptsCollection, { bbox: bboxIlce });

            voronoiPolys.features.forEach((vPoly, index) => {
                if (!vPoly) return;
                try {
                    // Clip the voronoi cell to the district boundaries
                    const clipped = intersect(featureCollection([vPoly, ilce]));
                    if (clipped) {
                        clipped.properties = ptsInIlce[index].properties;
                        generatedPolygons.push(clipped);
                        successCount++;
                    }
                } catch (e) { }
            });
        } catch (e) {
            console.log("Voronoi generation failed for district:", ilceName);
        }
    }

    // Sort features alphabetically by ilce then name
    generatedPolygons.sort((a, b) => {
        const iA = a.properties.ilce || '';
        const iB = b.properties.ilce || '';
        if (iA !== iB) return iA.localeCompare(iB);
        return (a.properties.name || '').localeCompare(b.properties.name || '');
    });

    console.log(`Generated map! Total covered neighborhoods: ${successCount} Polygons`);

    fs.writeFileSync('../client/public/konya_mahalleler.geojson', JSON.stringify({
        type: "FeatureCollection",
        features: generatedPolygons
    }));

    console.log("Done! Written array to konya_mahalleler.geojson");
}

buildRapidMahalleler().catch(console.error);
