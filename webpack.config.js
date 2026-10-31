'use strict';

const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const CopyWebpackPlugin = require('copy-webpack-plugin')
const webpack = require('webpack');

const isProduction = process.env.NODE_ENV === 'production';

module.exports = {
    mode: isProduction ? 'production' : 'development',
    entry: './app/index.ts',
    output: {
        filename:      isProduction?  '[name].[contenthash].js':       'main.js',
        chunkFilename: isProduction?  '[name].[contenthash].chunk.js': '[id].chunk.js',
        path: path.resolve(__dirname, 'dist'),
        //clean: true,
    },
    resolve: {
        extensions: [".ts", ".tsx", "..."],  //... means default: .js, .json, .wasm
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
            filename:      isProduction ? '[name].[contenthash].css'      : '[name].css',
            chunkFilename: isProduction ?   '[id].[contenthash].chunk.css':   '[id].chunk.css',
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
            use: [
                MiniCssExtractPlugin.loader,
                'css-loader',
                /* 'postcss-loader', 'sass-loader', */
            ],
        }, {
            test: /\.(woff|woff2|eot|ttf|otf|svg)$/,
            type: 'asset/resource', // Webpack 5 內建的資源模組，會自動複製字體檔並修正 CSS 路徑
            dependency: { not: ['url'] }, // 關鍵：防止 css-loader 將其重複解析為 JS 模組
            generator: {
                filename: 'fonts/[name][ext][query]' // 打包後的字體放置路徑（選填）
            },
        }],
    },
    // 開發環境使用快速的 source-map，生產環境用高品質或不使用
    devtool: isProduction ? 'source-map' : 'eval-cheap-module-source-map',

    optimization: {
        // 生產環境才進行程式碼分割最佳化
        splitChunks: isProduction? { chunks: 'all' }: false,
        runtimeChunk: isProduction? 'single': false,
    },
};
