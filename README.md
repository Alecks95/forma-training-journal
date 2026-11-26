# Form

[Open the tracker](https://alecks95.github.io/forma-training-journal/).

On iPhone, open the link in Safari, tap **Share**, choose **Add to Home Screen**, then open Form from its icon. Open it online once to prepare offline access. Friends can use the same link. Each installation has its own journal.

## Training

Create a routine with your exercises, sets, reps, weight, reps in reserve (RIR) and rest times. Start it to get a prefilled set table, or start an empty workout. Checking off a set starts that exercise’s timer. Finish the workout to add it to History and the exercise progression charts.

## Nutrition and weight

Save foods by portion and log any number of servings. Change calorie and macro targets in **Nutrition → Edit goals**. **Body weight** averages daily weigh-ins by calendar week, starting Monday, and compares the current week with the preceding week. **Settings** switches between kilograms and pounds.

## Backups

Form stores entries in IndexedDB on the device. Use **Settings → Export backup** before clearing site data or changing phones. Restore the file on the new device.

## Running locally

Serve `forma/dist` with a static HTTP server. For example, run `python -m http.server 8000 --directory forma/dist` from the project root and open `http://localhost:8000`. The tracker has no runtime dependencies. GitHub Actions publishes that directory to Pages on pushes to `main`.
