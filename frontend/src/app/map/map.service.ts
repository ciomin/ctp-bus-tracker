import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, catchError, throwError } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private apiUrl = 'https://api.tranzy.dev/v1/opendata/vehicles';
  private apiKey = '6vvrXArXKuazfWKpaSXPw5OmCnqHvi6w1yxs05w4';

  private httpOptions = {
    headers: new HttpHeaders({
      'X-Agency-Id': '2',
      'Accept': 'application/json',
      'Access-Control-Allow-Origin': '*',
      'X-API-KEY': this.apiKey,
    }),
  };

  constructor(private http: HttpClient) {}

  getData(): Observable<any> {
    return this.http.get<any>(this.apiUrl, this.httpOptions).pipe(
      catchError((error) => {
        console.error('Error fetching weather data:', error);
        return throwError('Error fetching weather data.');
      })
    );
  }
}
