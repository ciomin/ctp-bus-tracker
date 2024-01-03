import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import {GoogleMapsModule} from '@angular/google-maps';
import { HttpClient, HttpClientModule, HttpHeaders } from '@angular/common/http';
import { Observable, catchError, throwError } from 'rxjs';

@Component({
  selector: 'app-map',
  standalone: true,
  imports: [CommonModule, RouterOutlet, GoogleMapsModule, HttpClientModule],
  templateUrl: './map.component.html',
  styleUrl: './map.component.css'
})
export class MapComponent {
  private apiUrl = 'https://api.tranzy.dev/v1/opendata/vehicles';
  private apiKey = '6vvrXArXKuazfWKpaSXPw5OmCnqHvi6w1yxs05w4';
  markers: google.maps.LatLngLiteral[] = [];

  private httpOptions = {
    headers: new HttpHeaders({
      'X-Agency-Id': '2',
      'Accept': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-API-KEY': this.apiKey,
    }),
  };

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.getData().subscribe(
      (data) => {
        this.markers = data.map((item) => ({
          lat: item.latitude,
          lng: item.longitude,
          speed: item.speed
        }));
      },
      (error) => {
        console.error('Error handling data:', error);
      }
    );
  }

  getData(): Observable<any[]> {
    return this.http.get<any[]>(this.apiUrl, this.httpOptions).pipe(
      catchError((error) => {
        console.error('Error fetching weather data:', error);
        return throwError('Error fetching weather data.');
      })
    );
  }

  display: any;
  center: google.maps.LatLngLiteral = {
    lat: 46.7712,
    lng: 23.6236
  };
  zoom = 13.5;

  move(event: google.maps.MapMouseEvent) {
    if (event.latLng != null) {
      this.display = event.latLng.toJSON();
    }
  }
}
