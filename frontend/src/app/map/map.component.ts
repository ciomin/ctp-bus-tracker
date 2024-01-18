import {
  Component,
  Renderer2,
  OnInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { GoogleMap, GoogleMapsModule } from '@angular/google-maps';
import {
  HttpClient,
  HttpClientModule,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, catchError, throwError, forkJoin } from 'rxjs';

interface ShapePoint {
  shape_id: string;
  shape_pt_lat: number;
  shape_pt_lon: number;
  shape_pt_sequence: number;
  shape_dist_traveled?: number;
}

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, RouterOutlet, GoogleMapsModule, HttpClientModule],
  templateUrl: './map.component.html',
  styleUrls: ['./map.component.css'],
})
export class MapComponent {
  private apiKey = '6vvrXArXKuazfWKpaSXPw5OmCnqHvi6w1yxs05w4';
  private apiBaseUrl = 'https://api.tranzy.dev/v1/opendata';

  markers: google.maps.LatLngLiteral[] = [];
  userLocation: google.maps.LatLngLiteral | undefined;

  @ViewChild(GoogleMap, { static: false }) mapElement!: GoogleMap;

  private httpOptions = {
    headers: new HttpHeaders({
      'X-Agency-Id': '2',
      Accept: 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-API-KEY': this.apiKey,
    }),
  };

  constructor(
    private renderer: Renderer2,
    private el: ElementRef,
    private http: HttpClient
  ) {}

  routes: any[] = [];

  display: any;
  center: google.maps.LatLngLiteral = {
    lat: 46.7712,
    lng: 23.6236,
  };
  zoom = 13;
  options: google.maps.MapOptions = {
    streetViewControl: false, // Remove Street View button
    mapTypeControl: false, // Remove Map/Satellite button
    fullscreenControl: false, // Remove Fullscreen button
    maxZoom: 16,
    minZoom: 13,
  };

  move(event: google.maps.MapMouseEvent) {
    if (event.latLng != null) {
      this.display = event.latLng.toJSON();
    }
  }

  ngOnInit(): void {
    this.fetchAllData();
    this.fetchRoutes();
    // Request user's location
    //this.getUserLocation();
  }

  // getUserLocation() {
  //   if (navigator.geolocation) {
  //     navigator.geolocation.getCurrentPosition(
  //       (position) => {
  //         this.userLocation = {
  //           lat: position.coords.latitude,
  //           lng: position.coords.longitude,
  //         };
  //         // Add marker for user's location
  //         this.addUserLocationMarker();
  //       },
  //       (error) => {
  //         console.error('Error fetching geolocation', error);
  //         // Handle errors or denials here
  //       }
  //     );
  //   } else {
  //     console.log('Geolocation is not supported by this browser.');
  //     // Handle browser support issues
  //   }
  // }

  // addUserLocationMarker() {
  //   if (this.mapElement && this.userLocation) {
  //     new google.maps.Marker({
  //       position: this.userLocation,
  //       map: this.mapElement.googleMap,
  //       // Optional: Use a custom icon
  //       icon: 'path_to_custom_icon.png',
  //       title: 'Your Location',
  //     });
  //   }
  // }

  async fetchRoutes(): Promise<void> {
    this.http
      .get<any[]>(`${this.apiBaseUrl}/routes`, this.httpOptions)
      .subscribe(
        (data: any[]) => {
          this.routes = data.map((route) => ({
            id: route.route_id,
            shortName: route.route_short_name,
            longName: route.route_long_name,
          }));
        },
        (error) => {
          console.error('Error fetching routes:', error);
        }
      );
  }

  showRoutesMenu = false;

  toggleRoutesMenu() {
    this.showRoutesMenu = !this.showRoutesMenu;
  }

  allTrips: any[] = [];
  allShapes: any[] = [];
  allStops: any[] = [];
  allVehicles: any[] = [];

  selectedRouteId: number | null = null;
  selectedTrips: any[] = [];
  selectedShapes: any[] = [];
  selectedStops: any[] = [];
  selectedVehicles: any[] = [];

  fetchAllData() {
    forkJoin({
      trips: this.fetchAllTrips(),
      shapes: this.fetchAllShapes(),
      stops: this.fetchAllStops(),
      vehicles: this.fetchAllVehicles(),
    }).subscribe(
      (results) => {
        this.allTrips = results.trips;
        this.allShapes = results.shapes;
        this.allStops = results.stops;
        this.allVehicles = results.vehicles;
      },
      (error) => {
        console.error('Error fetching data:', error);
      }
    );
  }

  fetchAllTrips(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/trips`, this.httpOptions);
  }

  fetchAllShapes(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/shapes`, this.httpOptions);
  }

  fetchAllStops(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiBaseUrl}/stops`, this.httpOptions);
  }

  fetchAllVehicles(): Observable<any[]> {
    return this.http.get<any[]>(
      `${this.apiBaseUrl}/vehicles`,
      this.httpOptions
    );
  }

  selectRoute(routeId: number) {
    this.clearMapData();
    // Check if the selected route is the same as the currently active route
    if (routeId === this.selectedRouteId) {
      this.selectedRouteId = null;
      this.selectedTrips = [];
      this.selectedShapes = [];
      this.selectedStops = [];
      this.selectedVehicles = [];
      // Close the routes menu
      this.showRoutesMenu = false;
      return;
    }

    this.selectedRouteId = routeId;

    this.selectedTrips = this.allTrips.filter(
      (trip) => trip.route_id === routeId
    );

    // Extract unique shape IDs from trips
    const shapeIds = [
      ...new Set(this.selectedTrips.map((trip) => trip.shape_id)),
    ];

    // Fetch and group shape points for each shape ID
    this.selectedShapes = shapeIds.flatMap((shapeId) =>
      this.allShapes.filter((shape) => shape.shape_id === shapeId)
    );

    this.selectedStops = this.allStops;

    // Filter out vehicles with a null trip_id
    this.selectedVehicles = this.allVehicles.filter(
      (vehicle) => vehicle.route_id === routeId && vehicle.trip_id != null
    );

    // Update the map with new data
    this.updateShapesOnMap(this.selectedShapes);
    this.updateVehiclesOnMap(this.selectedVehicles);
    this.updateStopsOnMap(this.selectedStops);

    // Close the routes menu
    this.showRoutesMenu = false;
  }

  private shapePolylines: google.maps.Polyline[] = [];
  private stopMarkers: google.maps.Marker[] = [];
  private vehicleMarkers: google.maps.Marker[] = [];

  clearMapData() {
    // Clear shapes (polylines)
    this.shapePolylines.forEach((polyline) => polyline.setMap(null));
    this.shapePolylines = [];

    // Clear stop markers
    this.stopMarkers.forEach((marker) => marker.setMap(null));
    this.stopMarkers = [];

    // Clear vehicle markers
    this.vehicleMarkers.forEach((marker) => marker.setMap(null));
    this.vehicleMarkers = [];
  }

  groupShapesByShapeId(shapes: ShapePoint[]): Record<string, ShapePoint[]> {
    const groupedShapes = shapes.reduce(
      (acc: Record<string, ShapePoint[]>, shape: ShapePoint) => {
        if (!acc[shape.shape_id]) {
          acc[shape.shape_id] = [];
        }
        acc[shape.shape_id].push(shape);
        return acc;
      },
      {}
    );

    return groupedShapes;
  }

  updateShapesOnMap(shapes: ShapePoint[]) {
    const groupedShapes = this.groupShapesByShapeId(shapes);

    Object.keys(groupedShapes).forEach((shapeId) => {
      const shapeArray = groupedShapes[shapeId];
      const isWayDirection = shapeId.endsWith('_0'); // Assuming _0 is for way

      const polylineColor = isWayDirection ? '#0000FF' : '#FF0000'; // Blue for way, red for roundway
      const icons = [
        {
          icon: { path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW },
          offset: '100%',
          repeat: '100px', // Adjust as needed
        },
      ];

      const shapePath = new google.maps.Polyline({
        path: shapeArray.map((pt) => ({
          lat: pt.shape_pt_lat,
          lng: pt.shape_pt_lon,
        })),
        geodesic: true,
        strokeColor: polylineColor,
        strokeOpacity: 0.8,
        strokeWeight: 2,
        icons: icons,
      });

      if (this.mapElement && this.mapElement.googleMap) {
        shapePath.setMap(this.mapElement.googleMap);
      }

      this.shapePolylines.push(shapePath); // Store for later removal
    });
  }

  // createCustomMarkerIcon(shortName: string) {
  //   // Check if document is defined
  //   if (typeof document !== 'undefined') {
  //     const canvas = document.createElement('canvas');
  //     const context = canvas.getContext('2d');
  //     canvas.width = 30;
  //     canvas.height = 30;

  //     if (context) {
  //       // Draw the circle
  //       context.beginPath();
  //       context.arc(15, 15, 15, 0, 2 * Math.PI);
  //       context.fillStyle = 'black';
  //       context.fill();

  //       // Draw the text
  //       context.font = '12px Arial';
  //       context.fillStyle = 'yellow';
  //       context.textAlign = 'center';
  //       context.textBaseline = 'middle';
  //       context.fillText(shortName, 15, 15);
  //     }

  //     return {
  //       url: canvas.toDataURL(),
  //       scaledSize: new google.maps.Size(30, 30),
  //       origin: new google.maps.Point(0, 0),
  //       anchor: new google.maps.Point(15, 15),
  //     };
  //   }

  //   // Return a default icon if document is not defined
  //   return {
  //     path: google.maps.SymbolPath.CIRCLE,
  //     scale: 10,
  //     fillColor: 'black',
  //     fillOpacity: 1,
  //     strokeColor: 'yellow',
  //     strokeWeight: 1,
  //   };
  // }

  createCustomMarkerIcon(routeShortName: string): string {
    // Create a canvas element
    const canvas = document.createElement('canvas');
    canvas.width = 30;
    canvas.height = 30;
    const context = canvas.getContext('2d');

    if (context) {
      // Draw the black circle
      context.fillStyle = 'black';
      context.beginPath();
      context.arc(15, 15, 15, 0, Math.PI * 2);
      context.fill();

      // Set text style
      context.fillStyle = 'yellow';
      context.font = '12px Arial';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
    }

    // Measure text width (for horizontal centering)
    if (context) {
      const textWidth = context.measureText(routeShortName).width;

      // Draw the text onto the canvas
      context.fillText(routeShortName, 15, 15);
    }

    // Convert the canvas to a data URL
    return canvas.toDataURL();
  }

  updateVehiclesOnMap(vehicles: any[]) {
    vehicles.forEach((vehicle) => {
      let marker = this.vehicleMarkers.find((m) => m.getLabel() === vehicle.id);
      if (!marker) {
        // Find the route's short name using the vehicle's route_id
        const route = this.routes.find((r) => r.id === vehicle.route_id);
        const shortName = route ? route.shortName : 'Unknown';

        // Create icon using the route's short name
        const iconUrl = this.createCustomMarkerIcon(shortName);

        // Create a new marker
        marker = new google.maps.Marker({
          position: { lat: vehicle.latitude, lng: vehicle.longitude },
          map: this.mapElement.googleMap,
          icon: iconUrl,
          label: vehicle.id,
        });
        this.vehicleMarkers.push(marker);
      } else {
        // Update marker position if it already exists
        marker.setPosition(
          new google.maps.LatLng(vehicle.latitude, vehicle.longitude)
        );
      }
    });
  }

  updateStopsOnMap(stops: any[]) {
    const coordinatesAreCloseEnough = (
      coord1: { lat: number; lng: number },
      coord2: { lat: number; lng: number },
      threshold = 0.0001
    ) => {
      return (
        Math.abs(coord1.lat - coord2.lat) < threshold &&
        Math.abs(coord1.lng - coord2.lng) < threshold
      );
    };

    // Only use the shape points that are part of the selected route
    const relevantShapePoints = this.selectedShapes;

    stops.forEach((stop) => {
      // Check if the stop's coordinates match any of the relevant shape points
      const matchingShapePoints = relevantShapePoints.filter((shapePoint) => {
        return coordinatesAreCloseEnough(
          { lat: shapePoint.shape_pt_lat, lng: shapePoint.shape_pt_lon },
          { lat: stop.stop_lat, lng: stop.stop_lon }
        );
      });

      // If there is at least one matching shape point, display the stop on the map
      if (matchingShapePoints.length > 0) {
        // Assume the first match is sufficient to determine the direction
        const firstMatchingShape = matchingShapePoints[0];
        const isWayDirection = firstMatchingShape.shape_id.endsWith('_0');
        const markerColor = isWayDirection ? '#0000FF' : '#FF0000'; // Blue for way, red for roundway

        // Create a marker for the stop
        const stopMarker = new google.maps.Marker({
          position: { lat: stop.stop_lat, lng: stop.stop_lon },
          map: this.mapElement.googleMap,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8, // Size of the circle
            fillColor: markerColor,
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: 'white', // White border for visibility
          },
          title: stop.stop_name,
        });

        // Save the marker for potential later use
        this.stopMarkers.push(stopMarker);
      }
    });
  }

  /*updateStopsOnMap(stops: any[]) {
    // Helper function to calculate the distance between two coordinates
    const calculateDistance = (
      coord1: { lat: number; lng: number },
      coord2: { lat: number; lng: number }
    ) => {
      const R = 6371e3; // Earth's radius in meters
      const φ1 = (coord1.lat * Math.PI) / 180;
      const φ2 = (coord2.lat * Math.PI) / 180;
      const Δφ = ((coord2.lat - coord1.lat) * Math.PI) / 180;
      const Δλ = ((coord2.lng - coord1.lng) * Math.PI) / 180;

      const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // Distance in meters
    };

    const maxDistanceThreshold = 50; // maximum distance threshold in meters

    stops.forEach((stop) => {
      let closestShapePoint: any | null = null;
      let minDistance = Number.MAX_VALUE;

      this.selectedShapes.forEach((shapePoint) => {
        const distance = calculateDistance(
          { lat: shapePoint.shape_pt_lat, lng: shapePoint.shape_pt_lon },
          { lat: stop.stop_lat, lng: stop.stop_lon }
        );
        if (distance < minDistance) {
          minDistance = distance;
          closestShapePoint = shapePoint;
        }
      });

      // Create a marker only if the closest shape point is within the threshold
      if (closestShapePoint && minDistance <= maxDistanceThreshold) {
        const isWayDirection = closestShapePoint.shape_id.endsWith('_0');
        const markerColor = isWayDirection ? '#0000FF' : '#FF0000'; // Blue for way, red for roundway

        // Create a marker for the stop
        const stopMarker = new google.maps.Marker({
          position: { lat: stop.stop_lat, lng: stop.stop_lon },
          map: this.mapElement.googleMap,
          icon: {
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8, // Size of the circle
            fillColor: markerColor,
            fillOpacity: 1,
            strokeWeight: 2,
            strokeColor: 'white', // White border for visibility
          },
          title: stop.stop_name,
        });

        // Save the marker for potential later use
        this.stopMarkers.push(stopMarker);
      }
    });
  }*/

  async getData(vehicleId: number): Promise<Observable<any[]>> {
    return this.http
      .get<any[]>(
        `${this.apiBaseUrl}/vehicles?vehicle_id=${vehicleId}`,
        this.httpOptions
      )
      .pipe(
        catchError((error) => {
          console.error('Error fetching vehicle data:', error);
          return throwError('Error fetching vehicle data.');
        })
      );
  }

  // Method to log messages from the template
  log(message: string) {
    console.log(message);
  }
}
