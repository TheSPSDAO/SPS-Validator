# Getting Started with Splinterlands Validator UI

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Generating OpenAPI code
Since I'm too lazy to write code (and anyone should be), this project generates code based on `openapi.yml` to handle
calls to the validator API. Should there be any change simply open up `openapi.yml` and make the appropriate changes.
You can go to [The Online Editor](https://editor.swagger.io) and have visual feedback on what you're writing.

After you've made the changes simply run `npm run generate:openapi` and it will regenerate the code for you.

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.\
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.\
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.\
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.\
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.\
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.
