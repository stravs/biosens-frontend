// Main Voda page uses the Semafor view.
import { fromQuery } from '../lib/timerange.mjs';
import './skice/voda-1.mjs';

// Keep old time-range bookmarks opening Podatki.
if (fromQuery(location.search)) location.replace(`/podatki${location.search}`);
