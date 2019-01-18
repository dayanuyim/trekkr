'use strict';

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin')
const webpack = require('webpack');

module.exports = {
  mode: 'development',
  entry: './app/index.ts',
  output: {
      filename: 'main.js',
      path: path.resolve(__dirname, 'dist'),
  },
  resolve: {
      extensions: [".ts", ".tsx", ".js"]
  },
  plugins: [
      new HtmlWebpackPlugin({
          title: 'JustMaps',
          favicon: 'app/images/favicon.png',
      }),
      new webpack.ProvidePlugin({
          $: 'jquery',
          jQuery: 'jquery',
          Popper: 'popper.js'
      }),
      new MiniCssExtractPlugin({
          // Options similar to the same options in webpackOptions.output
          // both options are optional
          filename: "[name].css",
          chunkFilename: "[id].css"
      }),
      new CopyWebpackPlugin([
          {from: 'app/data', to: 'data'},
          {from: 'app/images', to: 'images'},
      ]),
  ],
  module: {
      rules: [{
          test: /\.tsx?$/,
          loader: 'ts-loader',
      }, {
          test: /\.(sa|sc|c)ss$/,
          use: [ MiniCssExtractPlugin.loader, 'css-loader',/* 'postcss-loader', 'sass-loader', */],
      }, {
          test: /\.(png|woff|woff2|eot|ttf|svg)$/,
          loader: 'url-loader?limit=100000',
      }],
  },
};

