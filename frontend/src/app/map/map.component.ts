import { Component, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { GoogleMapsModule } from '@angular/google-maps';
import {
  HttpClient,
  HttpClientModule,
  HttpHeaders,
} from '@angular/common/http';
import { Observable, catchError, throwError, forkJoin } from 'rxjs';
import { GoogleMap } from '@angular/google-maps';

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

  // Rest of the code...
  markers: google.maps.LatLngLiteral[] = [];

  @ViewChild(GoogleMap, { static: false }) mapElement!: GoogleMap;

  private httpOptions = {
    headers: new HttpHeaders({
      'X-Agency-Id': '2',
      Accept: 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-API-KEY': this.apiKey,
    }),
  };

  constructor(private http: HttpClient) {}

  routes: any[] = [];

  ngOnInit(): void {
    this.fetchAllData();
    this.fetchRoutes();
    //this.startVehicleUpdates(); // Start updating vehicles periodically
  }

  ngOnDestroy() {
    if (this.vehicleUpdateInterval) {
      clearInterval(this.vehicleUpdateInterval); // Clear interval when component is destroyed
    }
  }

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

    this.selectedStops = this.allStops.filter(
      (stop) => stop.route_id === routeId
    );
    this.selectedVehicles = this.allVehicles.filter(
      (vehicle) => vehicle.route_id === routeId
    );

    // Update the map with new data
    this.updateShapesOnMap(this.selectedShapes);
    //this.updateVehiclesOnMap(this.selectedVehicles);
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

  vehicleUpdateInterval: any;

  // startVehicleUpdates() {
  //   // Define an interval duration
  //   const updateInterval = 5000;

  //   // Set up the interval
  //   this.vehicleUpdateInterval = setInterval(() => {
  //     this.fetchLatestVehicleData();
  //   }, updateInterval);
  // }

  // fetchLatestVehicleData() {
  //   this.http
  //     .get<any[]>(`${this.apiBaseUrl}/vehicles`, this.httpOptions)
  //     .subscribe(
  //       (vehicles) => {
  //         this.updateVehiclesOnMap(vehicles);
  //       },
  //       (error) => {
  //         console.error('Error fetching updated vehicle data:', error);
  //       }
  //     );
  // }

  // updateVehiclesOnMap(vehicles: any[]) {
  //   const routeVehicles = vehicles.filter(
  //     (vehicle) => vehicle.route_id === this.selectedRouteId
  //   );

  //   routeVehicles.forEach((vehicle) => {
  //     let marker = this.vehicleMarkers.find((m) => m.getLabel() === vehicle.id);
  //     if (marker) {
  //       // Update existing marker position
  //       marker.setPosition(
  //         new google.maps.LatLng(vehicle.latitude, vehicle.longitude)
  //       );
  //     } else {
  //       // Find the route to get the short name
  //       const route = this.routes.find((r) => r.id === vehicle.route_id);
  //       const icon = this.createCustomMarkerIcon(route ? route.shortName : '');

  //       // Create new marker
  //       marker = new google.maps.Marker({
  //         position: { lat: vehicle.latitude, lng: vehicle.longitude },
  //         map: this.mapElement.googleMap,
  //         icon: icon,
  //         label: vehicle.id,
  //       });
  //       this.vehicleMarkers.push(marker);
  //     }
  //   });
  // }

  updateStopsOnMap(stops: any[]) {
    // Logic to place stop markers on the map
  }

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

  display: any;
  center: google.maps.LatLngLiteral = {
    lat: 46.7712,
    lng: 23.6236,
  };
  zoom = 13.5;

  move(event: google.maps.MapMouseEvent) {
    if (event.latLng != null) {
      this.display = event.latLng.toJSON();
    }
  }

  // Method to log messages from the template
  log(message: string) {
    console.log(message);
  }
}
