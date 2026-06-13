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
        extensions: [".ts", ".tsx", ".js"],
        fallback: {
            "url": require.resolve("url/")
        }
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Trekkr',
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
        new CopyWebpackPlugin({
            patterns: [
                { from: 'app/data', to: 'data' },
                { from: 'app/images', to: 'images' },
            ]
        }),
    ],
    module: {
        rules: [{
            test: /\.tsx?$/,
            loader: 'ts-loader',
            options: {
                configFile: 'tsconfig.json',
            }
        }, {
            test: /\.(sa|sc|c)ss$/,
            use: [ MiniCssExtractPlugin.loader, 'css-loader',/* 'postcss-loader', 'sass-loader', */],
        }, {
            test: /\.(woff|woff2|eot|ttf|otf|svg)$/,
            type: 'asset/resource', // Webpack 5 內建的資源模組，會自動複製字體檔並修正 CSS 路徑
            dependency: { not: ['url'] }, // 關鍵：防止 css-loader 將其重複解析為 JS 模組
            generator: {
                filename: 'fonts/[name][ext][query]' // 打包後的字體放置路徑（選填）
            },
        }],
    },
};

